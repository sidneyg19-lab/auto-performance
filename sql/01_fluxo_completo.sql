-- AUTO PERFORMANCE | Fluxo integrado | Aplicar somente no ambiente de homologacao e apos backup
-- Nao substitui as RPCs de venda direta existentes.
BEGIN;
-- Preflight: interrompe sem alterar nada quando ja existem vinculos duplicados.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.work_orders WHERE quote_id IS NOT NULL GROUP BY organization_id,quote_id HAVING count(*)>1) THEN
  RAISE EXCEPTION 'Ha OS duplicadas por orcamento. Corrija antes de instalar.';
 END IF;
 IF EXISTS (SELECT 1 FROM public.sales WHERE work_order_id IS NOT NULL GROUP BY organization_id,work_order_id HAVING count(*)>1) THEN
  RAISE EXCEPTION 'Ha vendas duplicadas por OS. Corrija antes de instalar.';
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS ap_one_os_per_quote ON public.work_orders(organization_id,quote_id) WHERE quote_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ap_one_sale_per_os ON public.sales(organization_id,work_order_id) WHERE work_order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ap_save_quote(p_org uuid,p_quote uuid,p_customer uuid,p_vehicle uuid,p_discount numeric,p_notes text,p_status text,p_items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid; i jsonb; v_type text; v_item uuid; v_qty numeric; v_price numeric; v_name text; v_total numeric:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_module_permission(p_org,'quotes',CASE WHEN p_quote IS NULL THEN 'create' ELSE 'edit' END) THEN RAISE EXCEPTION 'Sem permissao para salvar orcamento' USING ERRCODE='42501'; END IF;
 IF p_status NOT IN ('draft','sent','rejected') THEN RAISE EXCEPTION 'Use o fluxo de aprovacao para aprovar orcamento'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.customers WHERE id=p_customer AND organization_id=p_org) THEN RAISE EXCEPTION 'Cliente invalido'; END IF;
 IF p_vehicle IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.vehicles WHERE id=p_vehicle AND organization_id=p_org AND customer_id=p_customer) THEN RAISE EXCEPTION 'Veiculo invalido'; END IF;
 IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Informe de 1 a 100 itens'; END IF;
 IF p_discount IS NULL OR p_discount<0 THEN RAISE EXCEPTION 'Desconto invalido'; END IF;
 IF p_quote IS NOT NULL THEN
  PERFORM 1 FROM public.quotes WHERE id=p_quote AND organization_id=p_org AND status IN ('draft','sent','rejected') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orcamento nao pode ser editado'; END IF;
  IF EXISTS(SELECT 1 FROM public.work_orders WHERE organization_id=p_org AND quote_id=p_quote) THEN RAISE EXCEPTION 'Orcamento ja vinculado a OS'; END IF;
 END IF;
 FOR i IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  v_type:=i->>'type'; v_item:=(i->>'id')::uuid; v_qty:=(i->>'quantity')::numeric; v_price:=(i->>'price')::numeric;
  IF v_qty IS NULL OR v_qty<=0 OR v_price IS NULL OR v_price<0 THEN RAISE EXCEPTION 'Quantidade ou preco invalido'; END IF;
  IF v_type='product' THEN SELECT name INTO v_name FROM public.products WHERE id=v_item AND organization_id=p_org;
  ELSIF v_type='service' THEN SELECT name INTO v_name FROM public.services WHERE id=v_item AND organization_id=p_org;
  ELSE RAISE EXCEPTION 'Tipo de item invalido'; END IF;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Produto ou servico nao encontrado'; END IF;
  v_total:=v_total+v_qty*v_price;
 END LOOP;
 IF v_total-p_discount<=0 THEN RAISE EXCEPTION 'Total do orcamento deve ser positivo'; END IF;
 IF p_quote IS NULL THEN
  INSERT INTO public.quotes(organization_id,customer_id,vehicle_id,status,discount,notes)
  VALUES(p_org,p_customer,p_vehicle,p_status,p_discount,p_notes) RETURNING id INTO v_id;
 ELSE
  v_id:=p_quote;
  UPDATE public.quotes SET customer_id=p_customer,vehicle_id=p_vehicle,status=p_status,discount=p_discount,notes=p_notes WHERE id=v_id AND organization_id=p_org;
  DELETE FROM public.quote_items WHERE quote_id=v_id AND organization_id=p_org;
 END IF;
 FOR i IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  v_type:=i->>'type';v_item:=(i->>'id')::uuid;
  IF v_type='product' THEN SELECT name INTO v_name FROM public.products WHERE id=v_item AND organization_id=p_org;
  ELSE SELECT name INTO v_name FROM public.services WHERE id=v_item AND organization_id=p_org; END IF;
  INSERT INTO public.quote_items(organization_id,quote_id,item_type,product_id,service_id,description,quantity,unit_price)
  VALUES(p_org,v_id,v_type,CASE WHEN v_type='product' THEN v_item END,CASE WHEN v_type='service' THEN v_item END,v_name,(i->>'quantity')::numeric,(i->>'price')::numeric);
 END LOOP;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.ap_approve_quote_create_os(p_org uuid,p_quote uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q public.quotes%ROWTYPE; v_os uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_module_permission(p_org,'quotes','edit') OR NOT public.has_module_permission(p_org,'work_orders','create') THEN RAISE EXCEPTION 'Sem permissao para aprovar orcamento e gerar OS' USING ERRCODE='42501'; END IF;
 SELECT * INTO q FROM public.quotes WHERE id=p_quote AND organization_id=p_org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Orcamento inexistente'; END IF;
 IF q.status IN ('rejected','expired') THEN RAISE EXCEPTION 'Orcamento recusado ou expirado'; END IF;
 SELECT id INTO v_os FROM public.work_orders WHERE quote_id=p_quote AND organization_id=p_org;
 IF v_os IS NOT NULL THEN RETURN v_os; END IF;
 IF q.status NOT IN ('draft','sent','approved') THEN RAISE EXCEPTION 'Status nao permite aprovacao'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.quote_items WHERE quote_id=p_quote AND organization_id=p_org) THEN RAISE EXCEPTION 'Orcamento sem itens'; END IF;
 UPDATE public.quotes SET status='approved' WHERE id=p_quote AND organization_id=p_org;
 INSERT INTO public.work_orders(organization_id,quote_id,customer_id,vehicle_id,status,notes)
 VALUES(p_org,p_quote,q.customer_id,q.vehicle_id,'waiting',q.notes) RETURNING id INTO v_os;
 RETURN v_os;
END $$;

CREATE OR REPLACE FUNCTION public.ap_finish_os_prepare_sale(p_org uuid,p_os uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.work_orders%ROWTYPE; q public.quotes%ROWTYPE; v_sale uuid; v_total numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_module_permission(p_org,'work_orders','edit') OR NOT public.has_module_permission(p_org,'sales','create') THEN RAISE EXCEPTION 'Sem permissao para concluir OS' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM public.work_orders WHERE id=p_os AND organization_id=p_org FOR UPDATE;
 IF NOT FOUND OR o.status='cancelled' THEN RAISE EXCEPTION 'OS inexistente ou cancelada'; END IF;
 SELECT id INTO v_sale FROM public.sales WHERE work_order_id=p_os AND organization_id=p_org;
 IF v_sale IS NOT NULL THEN RETURN v_sale; END IF;
 IF o.quote_id IS NULL THEN RAISE EXCEPTION 'OS direta sem orcamento: adicione itens por orcamento antes de concluir'; END IF;
 SELECT * INTO q FROM public.quotes WHERE id=o.quote_id AND organization_id=p_org;
 IF NOT FOUND OR q.status NOT IN ('approved','converted') THEN RAISE EXCEPTION 'Orcamento aprovado nao encontrado'; END IF;
 SELECT COALESCE(sum(quantity*unit_price),0)-coalesce(q.discount,0) INTO v_total FROM public.quote_items WHERE quote_id=q.id AND organization_id=p_org;
 IF v_total<=0 THEN RAISE EXCEPTION 'Total invalido'; END IF;
 UPDATE public.work_orders SET status='finished',finished_at=coalesce(finished_at,now()) WHERE id=p_os AND organization_id=p_org;
 INSERT INTO public.sales(organization_id,customer_id,vehicle_id,work_order_id,total,discount,status)
 VALUES(p_org,o.customer_id,o.vehicle_id,p_os,v_total,coalesce(q.discount,0),'draft') RETURNING id INTO v_sale;
 INSERT INTO public.sale_items(organization_id,sale_id,item_type,product_id,service_id,description,quantity,unit_cost,unit_price)
 SELECT p_org,v_sale,qi.item_type,qi.product_id,qi.service_id,qi.description,qi.quantity,
 CASE WHEN qi.item_type='product' THEN coalesce(p.cost,0) ELSE 0 END,qi.unit_price
 FROM public.quote_items qi LEFT JOIN public.products p ON p.id=qi.product_id AND p.organization_id=p_org
 WHERE qi.quote_id=q.id AND qi.organization_id=p_org;
 RETURN v_sale;
END $$;

-- Liquidacao atomica de venda pendente. Taxas cobradas do cliente, pagamento dispara o caixa existente.
CREATE OR REPLACE FUNCTION public.ap_pay_os_sale(p_org uuid,p_sale uuid,p_method text,p_installments integer,p_brand text,p_locations jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.sales%ROWTYPE; it record; v_rate numeric:=0; v_base numeric; v_total numeric; v_brand text:=lower(trim(coalesce(p_brand,''))); v_location uuid; v_balance numeric; v_paid text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_module_permission(p_org,'sales','create') THEN RAISE EXCEPTION 'Sem permissao para receber venda' USING ERRCODE='42501'; END IF;
 IF p_method NOT IN ('pix','cash','credit','debit') THEN RAISE EXCEPTION 'Forma de pagamento invalida'; END IF;
 IF p_method IN ('credit','debit') AND v_brand NOT IN ('visa','mastercard','elo','amex','other') THEN RAISE EXCEPTION 'Bandeira invalida'; END IF;
 IF p_method NOT IN ('credit','debit') AND v_brand<>'' THEN RAISE EXCEPTION 'Bandeira so para cartao'; END IF;
 IF p_method='credit' THEN
  IF p_installments IS NULL OR p_installments NOT BETWEEN 1 AND 18 THEN RAISE EXCEPTION 'Parcelas invalidas'; END IF;
  SELECT rate_percent INTO v_rate FROM public.ap_card_rates WHERE organization_id=p_org AND installments=p_installments;
  IF NOT FOUND THEN RAISE EXCEPTION 'Taxa nao configurada'; END IF;
 ELSIF p_installments IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Parcelamento apenas no credito';
 ELSIF p_method='debit' THEN v_rate:=2.99; END IF;
 IF v_brand IN ('elo','amex') THEN v_rate:=v_rate+1; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_org::text,0));
 SELECT * INTO s FROM public.sales WHERE id=p_sale AND organization_id=p_org FOR UPDATE;
 IF NOT FOUND OR s.work_order_id IS NULL THEN RAISE EXCEPTION 'Venda de OS inexistente'; END IF;
 IF s.status<>'draft' THEN RAISE EXCEPTION 'Venda ja liquidada ou cancelada'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.work_orders WHERE id=s.work_order_id AND organization_id=p_org AND status='finished') THEN RAISE EXCEPTION 'OS deve estar concluida para receber'; END IF;
 IF EXISTS(SELECT 1 FROM public.payments WHERE organization_id=p_org AND sale_id=p_sale) THEN RAISE EXCEPTION 'Venda ja possui pagamento'; END IF;
 v_base:=s.total;
 IF v_base IS NULL OR v_base<=0 THEN RAISE EXCEPTION 'Total invalido'; END IF;
 FOR it IN SELECT * FROM public.sale_items WHERE organization_id=p_org AND sale_id=p_sale AND item_type='product' ORDER BY product_id,id LOOP
  v_location:=NULLIF(p_locations->>it.product_id::text,'')::uuid;
  IF v_location IS NULL THEN RAISE EXCEPTION 'Selecione estoque de origem para %',it.description; END IF;
  SELECT quantity INTO v_balance FROM public.ap_stock_balances WHERE organization_id=p_org AND product_id=it.product_id AND location_id=v_location FOR UPDATE;
  IF coalesce(v_balance,0)<it.quantity THEN RAISE EXCEPTION 'Estoque insuficiente para %',it.description; END IF;
  UPDATE public.ap_stock_balances SET quantity=quantity-it.quantity WHERE organization_id=p_org AND product_id=it.product_id AND location_id=v_location;
  INSERT INTO public.ap_stock_movements(organization_id,location_id,product_id,quantity_delta,reason,sale_id)
  VALUES(p_org,v_location,it.product_id,-it.quantity,'sale',p_sale);
  UPDATE public.products SET stock_qty=(SELECT coalesce(sum(quantity),0) FROM public.ap_stock_balances WHERE organization_id=p_org AND product_id=it.product_id) WHERE organization_id=p_org AND id=it.product_id;
 END LOOP;
 v_total:=round(v_base*(1+v_rate/100),2);
 UPDATE public.sales SET total=v_total,status='completed' WHERE id=p_sale AND organization_id=p_org;
 INSERT INTO public.ap_item_sales(sale_id,organization_id) VALUES(p_sale,p_org) ON CONFLICT DO NOTHING;
 INSERT INTO public.ap_sale_installments(sale_id,organization_id,installments,rate_percent,base_amount,fee_amount,total_amount,card_brand,payment_method)
 VALUES(p_sale,p_org,p_installments,v_rate,v_base,v_total-v_base,v_total,NULLIF(v_brand,''),p_method);
 v_paid:=CASE p_method WHEN 'credit' THEN 'credit_card' WHEN 'debit' THEN 'debit_card' ELSE p_method END;
 INSERT INTO public.payments(organization_id,sale_id,method,amount,paid_at) VALUES(p_org,p_sale,v_paid,v_total,now());
 RETURN p_sale;
END $$;

-- Cancelamento exclusivo para vendas geradas por OS. Reverte estoque e caixa (trigger de pagamentos).
CREATE OR REPLACE FUNCTION public.ap_cancel_os_sale(p_org uuid,p_sale uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.sales%ROWTYPE; m record;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_module_permission(p_org,'sales','edit') THEN RAISE EXCEPTION 'Sem permissao para cancelar venda' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_org::text,0));
 SELECT * INTO s FROM public.sales WHERE id=p_sale AND organization_id=p_org FOR UPDATE;
 IF NOT FOUND OR s.work_order_id IS NULL OR s.status='cancelled' THEN RAISE EXCEPTION 'Venda invalida ou ja cancelada'; END IF;
 IF EXISTS(SELECT 1 FROM public.work_orders WHERE id=s.work_order_id AND organization_id=p_org AND status='delivered') THEN RAISE EXCEPTION 'Entrega ja registrada: processe devolucao formal'; END IF;
 FOR m IN SELECT * FROM public.ap_stock_movements orig WHERE orig.organization_id=p_org AND orig.sale_id=p_sale AND orig.reason='sale' AND NOT EXISTS (SELECT 1 FROM public.ap_stock_movements rev WHERE rev.organization_id=p_org AND rev.sale_id=p_sale AND rev.reason='sale_reversal' AND rev.product_id=orig.product_id AND rev.location_id=orig.location_id) LOOP
  UPDATE public.ap_stock_balances SET quantity=quantity-m.quantity_delta WHERE organization_id=p_org AND location_id=m.location_id AND product_id=m.product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saldo de estoque nao encontrado para estorno'; END IF;
  INSERT INTO public.ap_stock_movements(organization_id,location_id,product_id,quantity_delta,reason,sale_id)
  VALUES(p_org,m.location_id,m.product_id,-m.quantity_delta,'sale_reversal',p_sale);
  UPDATE public.products SET stock_qty=(SELECT coalesce(sum(quantity),0) FROM public.ap_stock_balances WHERE organization_id=p_org AND product_id=m.product_id) WHERE id=m.product_id AND organization_id=p_org;
 END LOOP;
 DELETE FROM public.payments WHERE organization_id=p_org AND sale_id=p_sale;
 UPDATE public.sales SET status='cancelled' WHERE organization_id=p_org AND id=p_sale;
END $$;

CREATE TABLE IF NOT EXISTS public.ap_warranties (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),
 work_order_id uuid NOT NULL REFERENCES public.work_orders(id),sale_id uuid REFERENCES public.sales(id),
 details jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,work_order_id)
);
ALTER TABLE public.ap_warranties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ap_warranties_select ON public.ap_warranties;
CREATE POLICY ap_warranties_select ON public.ap_warranties FOR SELECT TO authenticated USING (public.has_module_permission(organization_id,'work_orders','view'));
DROP POLICY IF EXISTS ap_warranties_insert ON public.ap_warranties;
CREATE POLICY ap_warranties_insert ON public.ap_warranties FOR INSERT TO authenticated WITH CHECK (public.has_module_permission(organization_id,'work_orders','edit'));
DROP POLICY IF EXISTS ap_warranties_update ON public.ap_warranties;
CREATE POLICY ap_warranties_update ON public.ap_warranties FOR UPDATE TO authenticated USING (public.has_module_permission(organization_id,'work_orders','edit')) WITH CHECK (public.has_module_permission(organization_id,'work_orders','edit'));

REVOKE ALL ON FUNCTION public.ap_save_quote(uuid,uuid,uuid,uuid,numeric,text,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ap_approve_quote_create_os(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ap_finish_os_prepare_sale(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ap_pay_os_sale(uuid,uuid,text,integer,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ap_cancel_os_sale(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ap_save_quote(uuid,uuid,uuid,uuid,numeric,text,text,jsonb),public.ap_approve_quote_create_os(uuid,uuid),public.ap_finish_os_prepare_sale(uuid,uuid),public.ap_pay_os_sale(uuid,uuid,text,integer,text,jsonb),public.ap_cancel_os_sale(uuid,uuid) TO authenticated;

-- Entrega somente apos venda concluida e paga. Executar apos a migracao principal.
CREATE OR REPLACE FUNCTION public.ap_deliver_os(p_org uuid,p_os uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.work_orders%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_module_permission(p_org,'work_orders','edit') THEN RAISE EXCEPTION 'Sem permissao para entregar OS' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM public.work_orders WHERE id=p_os AND organization_id=p_org FOR UPDATE;
 IF NOT FOUND OR o.status NOT IN ('finished','delivered') THEN RAISE EXCEPTION 'OS nao concluida'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sales s JOIN public.payments p ON p.sale_id=s.id AND p.organization_id=p_org WHERE s.work_order_id=p_os AND s.organization_id=p_org AND s.status='completed') THEN
  RAISE EXCEPTION 'Confirme o pagamento antes da entrega';
 END IF;
 UPDATE public.work_orders SET status='delivered' WHERE id=p_os AND organization_id=p_org;
END $$;
REVOKE ALL ON FUNCTION public.ap_deliver_os(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ap_deliver_os(uuid,uuid) TO authenticated;

-- Nao permite entregar diretamente uma OS sem pagamento, mesmo por API.
CREATE OR REPLACE FUNCTION public.ap_guard_os_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.status='delivered' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'delivered') THEN
  IF NOT EXISTS (SELECT 1 FROM public.sales s JOIN public.payments p ON p.sale_id=s.id AND p.organization_id=NEW.organization_id
    WHERE s.organization_id=NEW.organization_id AND s.work_order_id=NEW.id AND s.status='completed') THEN
    RAISE EXCEPTION 'Entrega exige venda concluida e pagamento confirmado';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ap_guard_os_delivery_trigger ON public.work_orders;
CREATE TRIGGER ap_guard_os_delivery_trigger BEFORE INSERT OR UPDATE OF status ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.ap_guard_os_delivery();
GRANT SELECT, INSERT, UPDATE ON public.ap_warranties TO authenticated;
REVOKE ALL ON public.ap_warranties FROM anon;
COMMIT;

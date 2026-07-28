CREATE POLICY "Staff read records files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'records' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff upload records files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'records' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff update records files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'records' AND public.is_staff(auth.uid()))
WITH CHECK (bucket_id = 'records' AND public.is_staff(auth.uid()));

CREATE POLICY "Managers delete records files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'records' AND public.can_manage(auth.uid()));
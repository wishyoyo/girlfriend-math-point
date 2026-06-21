-- 在既有 Supabase 專案的 SQL Editor 執行一次。
-- 修正「不確認」與英文紀錄被舊 constraint 擋下，並允許歷史紀錄刪除。

alter table public.study_records drop constraint if exists study_records_status_check;
alter table public.study_records
  add constraint study_records_status_check
  check (status in ('pending', 'approved', 'rejected'));

alter table public.study_records drop constraint if exists study_records_book_type_check;
alter table public.study_records
  add constraint study_records_book_type_check
  check (book_type in ('lecture', 'workbook', 'english_daily', 'english_quiz'));

drop policy if exists "couple deletes records" on public.study_records;
create policy "couple deletes records" on public.study_records for delete
  using (couple_code = (select couple_code from public.profiles where id = auth.uid()));

drop policy if exists "couple deletes redemptions" on public.redemptions;
create policy "couple deletes redemptions" on public.redemptions for delete
  using (couple_code = (select couple_code from public.profiles where id = auth.uid()));

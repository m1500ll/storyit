-- Affiliate commission: 15 % of the first payment (was 20 %), for new and existing partners.
alter table affiliates alter column commission_rate set default 0.15;
update affiliates set commission_rate = 0.15 where commission_rate = 0.20;

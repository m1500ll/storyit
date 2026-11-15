#!/usr/bin/env python3
"""Send ONE e-mail in the Storyit look (black banner, white card, "À très vite, L'équipe Storyit" signature).

Usage:  python3 scripts/send-branded-mail.py mail.json
mail.json = {"to": "...", "subject": "...", "inner": "<tr>...</tr> rows of the body", "text": "plain-text version",
             "reply_to": "optional"}

How it works: the session's Supabase management access (injected by the environment proxy) runs SQL that calls the
`mailing` Edge Function with the cron token kept in the database vault, so no secret is ever needed here.
Rules agreed with the owner: ALWAYS send a preview to the owner first with "[APERÇU] " in front of the subject, and
send to the real recipient only after the owner says so.

Building blocks for `inner` (copy them, keep this style):
  title:   <tr><td style="font-size:24px;line-height:1.3;font-weight:800;color:#1f1b2e;padding-bottom:12px">Titre</td></tr>
  text:    <tr><td style="font-size:16px;line-height:1.6">Bonjour,<br><br>…</td></tr>
  list:    <tr><td style="padding:14px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"
            style="background:#f4f0ff;border-radius:12px;padding:14px 18px;font-size:15px;line-height:1.7">
            <tr><td>🎬 <strong>…</strong> …</td></tr></table></td></tr>
  button:  <tr><td align="center" style="padding:22px 0 8px"><a href="https://www.storyit.fun/app" style="display:inline-block;
            background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 28px;
            border-radius:12px">Texte du bouton</a></td></tr>
  small:   <tr><td style="font-size:13px;line-height:1.6;color:#4b4560">…</td></tr>
"""
import json
import sys
import time
import urllib.request

API = "https://api.supabase.com/v1/projects/hubkgvfiiszthzqyfguf/database/query"


def sql(query: str):
    req = urllib.request.Request(API, data=json.dumps({"query": query}).encode(), headers={"Content-Type": "application/json"}, method="POST")
    return json.load(urllib.request.urlopen(req, timeout=60))


def main():
    mail = json.load(open(sys.argv[1], encoding="utf-8"))
    for k in ("to", "subject", "inner", "text"):
        if not mail.get(k): sys.exit(f"missing {k}")
    body = json.dumps({"branded": mail}, ensure_ascii=False).replace("$m$", "")
    rid = sql("select net.http_post(url:='https://hubkgvfiiszthzqyfguf.supabase.co/functions/v1/mailing', "
              f"body:=$m${body}$m$::jsonb, headers:=jsonb_build_object('Authorization','Bearer '||(select decrypted_secret "
              "from vault.decrypted_secrets where name='publisher_cron_token'),'Content-Type','application/json'), "
              "timeout_milliseconds:=30000) as id")[0]["id"]
    for _ in range(30):
        time.sleep(2)
        r = sql(f"select status_code, content from net._http_response where id={int(rid)}")
        if r:
            print(r[0]["status_code"], r[0]["content"]); return
    print("no answer yet (request id", rid, ")")


if __name__ == "__main__":
    main()

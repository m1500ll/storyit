#!/usr/bin/env python3
"""Call a Storyit Edge Function with the cron token, from any Claude session (no secret needed in the session).

Usage:  python3 scripts/call-function.py <function> '<json body>'   [--get '<query string>']
Examples:
  python3 scripts/call-function.py mailing '{"campaign":"discord_launch","test_to":"owner@example.com"}'   # preview "[APERÇU]"
  python3 scripts/call-function.py mailing '{"campaign":"discord_launch"}'                                 # everyone (owner's OK!)
  python3 scripts/call-function.py llm-health '' --get 'balances=1'                                          # provider balances
  python3 scripts/call-function.py llm-health '' --get 'stripe_customer=cus_XXXX'                            # a customer's Stripe

The session's Supabase management access (injected by the environment proxy) runs SQL; pg_net calls the function
with the token kept in the database vault (`publisher_cron_token`).
"""
import json
import sys
import time
import urllib.request

API = "https://api.supabase.com/v1/projects/hubkgvfiiszthzqyfguf/database/query"
BASE = "https://hubkgvfiiszthzqyfguf.supabase.co/functions/v1/"
AUTH = "jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='publisher_cron_token'),'Content-Type','application/json')"


def sql(query: str):
    req = urllib.request.Request(API, data=json.dumps({"query": query}).encode(), headers={"Content-Type": "application/json"}, method="POST")
    return json.load(urllib.request.urlopen(req, timeout=60))


def main():
    fn, body = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "")
    if "--get" in sys.argv:
        qs = sys.argv[sys.argv.index("--get") + 1]
        q = f"select net.http_get(url:='{BASE}{fn}?{qs}', headers:={AUTH}, timeout_milliseconds:=120000) as id"
    else:
        json.loads(body)  # must be valid JSON
        q = f"select net.http_post(url:='{BASE}{fn}', body:=$b${body.replace('$b$', '')}$b$::jsonb, headers:={AUTH}, timeout_milliseconds:=290000) as id"
    rid = int(sql(q)[0]["id"])
    for _ in range(150):
        time.sleep(2)
        r = sql(f"select status_code, content from net._http_response where id={rid}")
        if r:
            print(r[0]["status_code"], r[0]["content"]); return
    print("no answer yet (pg_net request id", rid, ")")


if __name__ == "__main__":
    main()

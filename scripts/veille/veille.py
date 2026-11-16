# Weekly TikTok trend watch: for each public account handle, lists its videos (views, likes, shares, duration),
# then downloads, transcribes (ElevenLabs, key injected by the proxy) and makes a contact sheet of its 5 best and 3 worst.
# Usage: python3 -I scripts/veille/veille.py <output_dir> $(cat scripts/veille/accounts.txt)
# Learn the mechanics only: never copy stories, lines or visuals into the studio.
import json,subprocess,sys,os,datetime
S=sys.argv[1]; handles=sys.argv[2:]
def sh(*a,**k): return subprocess.run(list(a),capture_output=True,text=True,**k)
for h in handles:
    d=f'{S}/v_{h}'; os.makedirs(d,exist_ok=True)
    entries=[]
    for _ in range(2):
        r=sh('timeout','240','yt-dlp','--no-warnings','--flat-playlist','-J',f'https://www.tiktok.com/@{h}')
        try: entries=[x for x in json.loads(r.stdout).get('entries',[]) if x]
        except Exception: entries=[]
        if entries: break
    rows=[(x.get('view_count') or 0,x.get('like_count') or 0,x.get('comment_count') or 0,x.get('repost_count') or 0,x.get('duration'),x.get('timestamp'),(x.get('title') or '')[:90],x['url'].split('/')[-1]) for x in entries]
    json.dump(rows,open(f'{d}/rows.json','w'))
    print('ACCOUNT',h,len(rows),flush=True)
    if not rows: continue
    rs=sorted(rows,reverse=True)
    pick=[('top',r) for r in rs[:5]]+[('flop',r) for r in rs[-3:] if len(rs)>8]
    for tag,r in pick:
        vid=r[7]; vd=f'{d}/{tag}_{vid}'; os.makedirs(vd,exist_ok=True)
        if not os.path.exists(f'{vd}/v.mp4'):
            sh('timeout','300','yt-dlp','-q','--no-warnings','-o',f'{vd}/v.mp4',f'https://www.tiktok.com/@{h}/video/{vid}')
        if not os.path.exists(f'{vd}/v.mp4'): print('skip',h,vid,flush=True); continue
        sh('ffmpeg','-loglevel','error','-y','-i',f'{vd}/v.mp4','-vn','-ac','1','-ar','16000',f'{vd}/a.mp3')
        sh('ffmpeg','-loglevel','error','-y','-i',f'{vd}/v.mp4','-vf','fps=1/4,scale=170:-1,tile=8x4','-frames:v','1',f'{vd}/c.jpg')
        out=sh('curl','-s','https://api.elevenlabs.io/v1/speech-to-text','-H','xi-api-key: dummy','-F','model_id=scribe_v1','-F',f'file=@{vd}/a.mp3').stdout
        try: w=[x for x in json.loads(out).get('words',[]) if x['type']=='word']
        except Exception: w=[]
        lines,line,t0=[],'',0
        for x in w:
            if not line: t0=x['start']
            line+=x['text']+' '
            if x['text'][-1:] in '.?!': lines.append(f'{t0:5.1f} {line.strip()}'); line=''
        if line: lines.append(f'{t0:5.1f} {line.strip()}')
        open(f'{vd}/t.txt','w').write(f'{tag} {r[0]} vues {r[1]} likes {r[2]} comm {r[3]} partages {r[4]}s | {r[6]}\n'+'\n'.join(lines))
        print('done',h,tag,vid,flush=True)
print('ALL DONE',flush=True)

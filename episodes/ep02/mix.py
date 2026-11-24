import json, subprocess, sys
seg = json.load(open('segments.json'))
for L in ['en','hi']:
    parts, labs = [], []
    for k, s in enumerate(seg):
        a, d = s[L]['start'], s[L]['dur']; ms = int(s['start'] * 1000)
        parts.append(f"[0]atrim={a:.3f}:{a+d:.3f},asetpts=PTS-STARTPTS,adelay={ms}|{ms}[v{k}]"); labs.append(f"[v{k}]")
    fc = ";".join(parts) + f";{''.join(labs)}amix=inputs={len(labs)}:normalize=0,aformat=channel_layouts=stereo,apad[vo];[vo]asplit[vo1][vo2];[1][vo1]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[mus];[mus][vo2]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.89[a]"
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',f'{L}.wav','-i','music.wav','-filter_complex',fc,'-map','[a]','-ar','48000','-c:a','pcm_s16le',f'track_{L}.wav'], check=True)
    print(L, 'ok')
def ts(x): h=int(x//3600); m=int(x%3600//60); s=x%60; return f"{h:02}:{m:02}:{int(s):02},{int((s%1)*1000):03}"
for L, f in [('en','script.json'),('hi','script_hi.json')]:
    lines=json.load(open(f))
    open(f'out/Ep2_captions_{L}.srt','w').write("\n".join(f"{i+1}\n{ts(s['start'])} --> {ts(s['start']+s[L]['dur'])}\n{lines[i]}\n" for i,s in enumerate(seg)))

# usage: python3 add_voice.py narration.mp3  -> out/Ep1_final.mp4
import json, subprocess, sys
seg = json.load(open('segments.json')); src = sys.argv[1]
parts, labels = [], []
for k, s in enumerate(seg):
    a, d = s['src']['start'], s['src']['dur']; ms = int(s['start'] * 1000)
    parts.append(f"[0]atrim={a:.3f}:{a+d:.3f},asetpts=PTS-STARTPTS,adelay={ms}|{ms}[v{k}]"); labels.append(f"[v{k}]")
fc = ";".join(parts) + f";{''.join(labels)}amix=inputs={len(labels)}:normalize=0,volume=1.0,aformat=channel_layouts=stereo[vo];[vo]asplit[vo1][vo2];[vo1]apad[vp];[1][vp]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[mus];[mus][vo2]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5,apad[a]"
subprocess.run(['ffmpeg','-y','-loglevel','error','-i',src,'-i','music.m4a','-i','video_silent.mp4','-filter_complex',fc,'-map','2:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart','out/Ep1_final.part.mp4'], check=True)
subprocess.run(['mv','out/Ep1_final.part.mp4','out/Ep1_Sources_of_Indian_History_FINAL.mp4'])
print('done')

from kokoro_onnx import Kokoro
import soundfile as sf, numpy as np, json
k = Kokoro('kokoro-v1.0.onnx','voices-v1.0.bin')
lines = json.load(open('/home/claude/ep1/script.json'))
lines = [l.replace('Fa-Hien','Fa Hien').replace('Mohenjo-daro','Mohenjo-daro').replace('Al-Biruni','Al Biruni') for l in lines]
allw=[]; tim=[]; t=0; sr=24000
for i,l in enumerate(lines):
    a, sr = k.create(l, voice='am_onyx', speed=0.9, lang='en-us')
    # trim silence
    idx=np.where(np.abs(a)>0.01)[0]; a=a[max(0,idx[0]-1200):idx[-1]+2400]
    tim.append({'start':t,'dur':len(a)/sr}); t+=len(a)/sr; allw.append(a)
sf.write('narr_raw.wav', np.concatenate(allw), sr)
json.dump(tim, open('/home/claude/ep1/timings.json','w'))
print('total', t)

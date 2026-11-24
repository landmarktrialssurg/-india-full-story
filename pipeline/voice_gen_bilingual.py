import sys, json, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
k = Kokoro('kokoro-v1.0.onnx','voices-v1.0.bin')
lang, src, voice, out = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
lines = json.load(open(src))
if lang=='en': lines=[l.replace('Homo erectus','Homo erectus') for l in lines]
allw=[]; tim=[]; t=0
for l in lines:
    a, sr = k.create(l, voice=voice, speed=0.9 if lang=='en' else 1.0, lang='en-us' if lang=='en' else 'hi')
    idx=np.where(np.abs(a)>0.01)[0]; a=a[max(0,idx[0]-1200):idx[-1]+2400]
    tim.append({'start':t,'dur':len(a)/sr}); t+=len(a)/sr; allw.append(a)
sf.write(out+'_raw.wav', np.concatenate(allw), sr); json.dump(tim, open(out+'_tim.json','w')); print(lang,'total',round(t,1))

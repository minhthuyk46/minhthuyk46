"""Tạo 10 audio DF-01 bằng Gemini TTS (key miễn phí AI Studio). Chạy: GEMINI_API_KEY=... python3 tools/tts_df01.py
Đọc script từ exports/DF-01_media_checklist.xlsx, ghi WAV vào exports/audio/."""
import os, json, base64, struct, urllib.request, openpyxl, re, time
KEY = os.environ['GEMINI_API_KEY']
URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=' + KEY
VOICE = {'F': 'Kore', 'M': 'Charon'}
def wav(pcm, rate=24000):
    return b'RIFF' + struct.pack('<I', 36 + len(pcm)) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, 1, rate, rate * 2, 2, 16) + b'data' + struct.pack('<I', len(pcm)) + pcm
def tts(script):
    who = sorted(set(re.findall(r'^([FM])[:：]', script, re.M)))
    text = 'Read this Japanese naturally at a normal JLPT listening pace:\n' + script.replace('：', ': ')
    if len(who) == 2:
        sc = {'multiSpeakerVoiceConfig': {'speakerVoiceConfigs': [{'speaker': s, 'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': VOICE[s]}}} for s in who]}}
    else:
        text = 'Read this Japanese announcement naturally:\n' + re.sub(r'^[FM][:：]', '', script, flags=re.M)
        sc = {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': VOICE[who[0]]}}}
    body = {'contents': [{'parts': [{'text': text}]}], 'generationConfig': {'responseModalities': ['AUDIO'], 'speechConfig': sc}}
    req = urllib.request.Request(URL, json.dumps(body).encode(), {'Content-Type': 'application/json'})
    r = json.load(urllib.request.urlopen(req, timeout=180))
    return base64.b64decode(r['candidates'][0]['content']['parts'][0]['inlineData']['data'])
os.makedirs('exports/audio', exist_ok=True)
ws = openpyxl.load_workbook('exports/DF-01_media_checklist.xlsx').active
for typ, name, d, sc in ws.iter_rows(min_row=2, values_only=True):
    if typ != 'Audio': continue
    out = 'exports/audio/' + name
    if os.path.exists(out): continue
    for k in range(3):
        try: data = wav(tts(sc)); open(out, 'wb').write(data); print('OK', name); break
        except Exception as e: print('lỗi', name, e); time.sleep(20)

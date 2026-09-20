#!/usr/bin/env python3
"""Render the Ukrainian guide in uk/assets/ as a single PDF.

Usage:
    python3 tools/build-pdf.py --fetch     # download images into .pdfcache/, then build
    python3 tools/build-pdf.py             # build from whatever is already cached

Needs Google Chrome for the final HTML-to-PDF step and macOS `sips` to downscale
images. Writes Louvre-Guide-UK.pdf in the repository root.

Images come from Wikimedia Commons, resolved from the image_source field of each
English file in assets/. upload.wikimedia.org rate-limits hard, so --fetch backs
off and retries; a missing image just means that item renders without a figure.
"""
import argparse, html, json, os, re, io, subprocess, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE = os.path.join(ROOT, '.pdfcache')
UA = {'User-Agent': 'louvre-guide-content/1.0 (personal museum guide project)'}


def fetch_images():
    """Download each item's image into .pdfcache/img/, downscaled to <=1000px.

    Reads the `image` field of each English file, which points at a Wikimedia
    thumbnail. Full-size originals on upload.wikimedia.org are rate-limited and
    will start returning 429; the thumbnail hosts are not.
    """
    raw, small = os.path.join(CACHE, 'raw'), os.path.join(CACHE, 'img')
    os.makedirs(raw, exist_ok=True)
    os.makedirs(small, exist_ok=True)
    ok = miss = 0
    for f in sorted(os.listdir(os.path.join(ROOT, 'assets'))):
        if not f.endswith('.md') or f == 'INDEX.md':
            continue
        iid = f[:-3]
        dest = os.path.join(small, iid + '.jpg')
        if os.path.exists(dest) and os.path.getsize(dest) > 5000:
            ok += 1
            continue
        src = open(os.path.join(ROOT, 'assets', f), encoding='utf-8').read()
        url = re.search(r'^image: (.+)$', src, re.M).group(1)
        data = None
        for a in range(5):
            try:
                got = urllib.request.urlopen(
                    urllib.request.Request(url, headers=UA), timeout=90).read()
                if len(got) > 5000:
                    data = got
                    break
            except Exception:
                pass
            time.sleep(6 * (a + 1))
        if data is None:
            print('failed:', iid)
            miss += 1
            continue
        rawp = os.path.join(raw, iid + '.jpg')
        open(rawp, 'wb').write(data)
        subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '68',
                        '-Z', '1000', rawp, '--out', dest],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        ok += 1
        time.sleep(0.6)
    print('images ready: %d, missing: %d' % (ok, miss))


WING_ORDER = [('Денон', 'Антресоль'), ('Денон', '0'), ('Денон', '0 to 1'), ('Денон', '1'),
              ('Сюллі', '-1'), ('Сюллі', '0'), ('Сюллі', '1'), ('Сюллі', '2'),
              ('Рішельє', '-1'), ('Рішельє', '0'), ('Рішельє', '1'), ('Рішельє', '2'),
              ('Двір Наполеона', '0')]
TYPE = {'painting': 'живопис', 'sculpture': 'скульптура', 'object': 'предмет',
        'interior': 'інтер\u2019єр', 'architecture': 'архітектура'}
CROWD = {'very low': 'дуже мало людей', 'low': 'мало людей', 'medium': 'помірно',
         'high': 'багато людей', 'extreme': 'величезний натовп'}

UK = os.path.join(ROOT, 'uk', 'assets')

args = argparse.ArgumentParser(description=__doc__)
args.add_argument('--fetch', action='store_true', help='download images before building')
opts = args.parse_args()
os.makedirs(CACHE, exist_ok=True)
if opts.fetch:
    fetch_images()

IMGDIR = os.path.join(CACHE, 'img')
imgs = {f[:-4]: os.path.join(IMGDIR, f) for f in sorted(os.listdir(IMGDIR))
        if f.endswith('.jpg')} if os.path.isdir(IMGDIR) else {}


def parse(path):
    s=open(path,encoding='utf-8').read()
    m=re.match(r'^---\n(.*?)\n---\n(.*)$', s, re.S)
    fm={}
    for line in m.group(1).split('\n'):
        if ':' in line and not line.startswith(' '):
            k,v=line.split(':',1); fm[k.strip()]=v.strip().strip('"')
    return fm, m.group(2)

def inline(t):
    t=html.escape(t)
    t=re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'\1', t)          # drop md links, keep text
    t=re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', t)
    t=re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<em>\1</em>', t)
    t=re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    return t

def md(body):
    out=[]; lst=None
    for raw in body.split('\n'):
        line=raw.rstrip()
        if not line.strip():
            if lst: out.append('</ul>'); lst=None
            continue
        if line.startswith('### '):
            if lst: out.append('</ul>'); lst=None
            out.append(f'<h4>{inline(line[4:].strip())}</h4>')
        elif line.startswith('## '):
            if lst: out.append('</ul>'); lst=None
            out.append(f'<h3>{inline(line[3:].strip())}</h3>')
        elif line.startswith('# '):
            continue
        elif line.startswith('- '):
            if not lst: out.append('<ul>'); lst=True
            out.append(f'<li>{inline(line[2:].strip())}</li>')
        else:
            if lst: out.append('</ul>'); lst=None
            out.append(f'<p>{inline(line.strip())}</p>')
    if lst: out.append('</ul>')
    return '\n'.join(out)

items=[]
for f in sorted(x for x in os.listdir(UK) if x.endswith('.md') and x!='INDEX.md'):
    fm, body = parse(UK+'/'+f)
    items.append((f[:-3], fm, body))

def sortkey(it):
    fm=it[1]
    try: wi=WING_ORDER.index((fm.get('wing'), fm.get('level')))
    except ValueError: wi=99
    r=fm.get('room') or ''
    mm=re.match(r'(\d+)', r)
    return (wi, int(mm.group(1)) if mm else 9999, fm.get('title',''))
items.sort(key=sortkey)

CSS = """
@page { size: A4; margin: 17mm 15mm 16mm 15mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: "Charter","Georgia","Times New Roman",serif; font-size: 10.6pt; line-height: 1.5;
       color: #1a1a1a; margin: 0; }
h1,h2,h3,h4,.meta,.kicker,.toc,.cover { font-family: "Helvetica Neue","Arial",sans-serif; }
p { margin: 0 0 .58em; text-align: justify; hyphens: auto; }
ul { margin: 0 0 .7em; padding-left: 1.1em; }
li { margin-bottom: .3em; }

.cover { page-break-after: always; height: 258mm; display: flex; flex-direction: column;
         justify-content: center; text-align: center; }
.cover .rule { width: 56px; height: 3px; background:#8c1d18; margin: 0 auto 26px; }
.cover h1 { font-size: 54pt; letter-spacing: -1.5px; margin: 0 0 6px; font-weight: 700; }
.cover .sub { font-size: 16pt; color:#555; margin-bottom: 40px; font-weight: 400; }
.cover .facts { font-size: 10.5pt; color:#666; line-height: 2; }

.front { page-break-after: always; }
.front h2 { font-size: 20pt; margin: 0 0 14px; border-bottom: 2px solid #1a1a1a; padding-bottom: 6px; }
.front h3 { font-size: 12pt; margin: 18px 0 6px; color:#8c1d18; }

.toc { page-break-after: always; }
.toc h2 { font-size: 20pt; margin: 0 0 14px; border-bottom: 2px solid #1a1a1a; padding-bottom: 6px; }
.toc h3 { font-size: 10.5pt; margin: 14px 0 5px; color:#8c1d18; text-transform: uppercase;
          letter-spacing: .5px; }
.toc ol { margin:0; padding-left: 0; list-style: none; font-size: 9.6pt; }
.toc li { margin-bottom: 2.5px; display: flex; gap: 8px; }
.toc .n { color:#999; min-width: 22px; text-align: right; }
.toc .rm { color:#999; min-width: 34px; }
.toc .tt { flex: 1; }

.item { page-break-before: always; }
.item .kicker { font-size: 8.5pt; letter-spacing: 1.4px; text-transform: uppercase;
                color:#8c1d18; margin-bottom: 7px; font-weight: 600; }
.item h2 { font-size: 22pt; line-height: 1.12; margin: 0 0 6px; font-weight: 700; }
.item .byline { font-size: 11pt; color:#444; margin: 0 0 12px; font-style: italic;
                font-family:"Charter","Georgia",serif; }
.item h3 { font-size: 11.5pt; margin: 15px 0 6px; padding-top: 7px;
           border-top: 1px solid #d6d2cc; break-after: avoid; }
.item h4 { font-size: 10.3pt; margin: 11px 0 4px; color:#8c1d18; break-after: avoid; }

figure { margin: 0 0 13px; break-inside: avoid; text-align: center; }
figure img { max-width: 100%; max-height: 108mm; object-fit: contain; }
figcaption { font-family:"Helvetica Neue",Arial,sans-serif; font-size: 7.8pt; color:#888;
             margin-top: 5px; text-align: left; }

table.meta { width: 100%; border-collapse: collapse; font-family:"Helvetica Neue",Arial,sans-serif;
             font-size: 8.6pt; margin: 0 0 13px; break-inside: avoid; }
table.meta td { padding: 3px 8px 3px 0; vertical-align: top; border-bottom: 1px solid #ece9e4; }
table.meta td.k { color:#888; width: 30%; white-space: nowrap; }

.credits { page-break-before: always; }
.credits h2 { font-size: 20pt; margin: 0 0 12px; border-bottom: 2px solid #1a1a1a; padding-bottom: 6px; }
table.cr { width:100%; border-collapse: collapse; font-size: 7.6pt;
           font-family:"Helvetica Neue",Arial,sans-serif; }
table.cr th { text-align:left; border-bottom:1px solid #1a1a1a; padding:4px 6px 4px 0; }
table.cr td { padding:3px 6px 3px 0; border-bottom:1px solid #eee; vertical-align: top;
              word-break: break-word; }
"""

o=io.StringIO()
o.write('<!doctype html><html lang="uk"><head><meta charset="utf-8">')
o.write('<title>Лувр. Особистий путівник</title>')
o.write(f'<style>{CSS}</style></head><body>')

# cover
o.write(f"""
<section class="cover">
  <div class="rule"></div>
  <h1>Лувр</h1>
  <div class="sub">Особистий путівник</div>
  <div class="facts">
    {len(items)} експонатів у трьох крилах<br>
    Живопис, скульптура, предмети та зали<br>
    Українська версія
  </div>
</section>""")

# front matter
o.write("""
<section class="front">
<h2>Як користуватися цим путівником</h2>
<p>Кожен експонат має свою сторінку. Спершу йде рядок із крилом, рівнем і залою, далі таблиця з
основними даними, зображення, а тоді текст у сталому порядку: одним рядком, що ви бачите, історія,
знайдіть, цікаві факти, іноді практичні поради і тема для розмови.</p>
<p>Розділ «Знайдіть» перелічує фізичні речі, які видно на поверхні твору. Це те, заради чого варто
підійти ближче. «Тема для розмови» це одна річ, яку можна зробити або обговорити вдвох.</p>
<p>Порядок сторінок збігається з порядком обходу: крило Денон, далі Сюллі, далі Рішельє, усередині
за рівнями й номерами зал.</p>

<h3>Половина дня, близько 3 годин</h3>
<p>Вхід через Сюллі. Зала каріатид і Сплячий Гермафродит, потім Венера Мілоська, потім сходами Дару
нагору до Ніки Самофракійської. Фрески Боттічеллі, Квадратний салон, Велика галерея з Леонардо,
Зала держав з Моною Лізою і Веронезе, зали Мольєн і Дару з великими французькими полотнами. Униз
до галереї Мікеланджело по Рабів і Канову. Вихід повз Піраміду.</p>

<h3>Повний день, близько 6 годин із перервою</h3>
<p>Ранок як вище, завершення в Деноні близько полудня. Перерва у Дворі Марлі, Рішельє рівень -1, де
є лави, денне світло і майже нікого.</p>
<p>По обіді Рішельє. Двори Марлі й Пюже, потім рівень 0 по Хаммурапі, ламассу у Дворі Хорсабада,
Ебіх-Іля, стелу Нарам-Сіна і гробницю Філіппа По. Рівень 1 по апартаменти Наполеона III. Рівень 2
по Галерею Медічі, двох Вермеерів, Рембрандтів і ван Ейка в нідерландських залах.</p>

<h3>Другий візит</h3>
<p>Сюллі. Середньовічний рів на рівні -1, Крипта Сфінкса, потім єгипетські старожитності на рівні 1
по Сидячого писаря, ніж із Гебель-ель-Арака і зодіак із Дендери. Рівень 2 по французький живопис
від П'єти з Вільнева через Латура, Ватто, Шардена і Фраґонара. Далі антресоль Денона по Даму з
Осера і етруські зали.</p>

<h3>Практичне</h3>
<ul>
<li>Бронюйте квиток на визначений час онлайн. Без нього зайти складно.</li>
<li>Вхід через Піраміду має найдовші черги. Вхід через Carrousel du Louvre, з вулиці Ріволі 99 або
від метро Palais Royal Musée du Louvre, зазвичай швидший.</li>
<li>Вівторок вихідний. Подовжені години в середу і п'ятницю, і це найтихіший час, щоб побачити
Мону Лізу.</li>
<li>Безкоштовний гардероб під Пірамідою. Великі сумки в зали не пускають.</li>
<li>Кафе: Café Mollien у Деноні на рівні 1, біля зали Мольєн, з терасою. Café Richelieu на рівні 1
крила Рішельє.</li>
<li>Завантажте офіційний застосунок Лувру. Він показує закриті зали в реальному часі й веде
маршрутом, чого статичний путівник не може.</li>
</ul>

<h3>Стан справ, станом на вересень 2026 року</h3>
<ul>
<li>Мона Ліза досі в залі 711. Проєкт Louvre Nouvelle Renaissance перенесе її до спеціально
збудованої зали під Квадратним двором з окремим квитком, орієнтовно до 2031 року.</li>
<li>Галерея Аполлона знову відкрилася 22 липня 2026 року після крадіжки восьми предметів
французьких коронних коштовностей у жовтні 2025-го. Вітрин немає, коштовності не виставлені.</li>
<li>Зали іспанського живопису в Деноні, 720–734, мали тривалі часткові закриття, і це стосується
Мурільйо.</li>
</ul>
</section>""")

# toc
o.write('<section class="toc"><h2>Зміст</h2>')
n=0; cur=None
for iid, fm, body in items:
    key=(fm.get('wing'), fm.get('level'))
    if key!=cur:
        if cur is not None: o.write('</ol>')
        cur=key
        o.write(f'<h3>Крило {html.escape(str(fm.get("wing")))}, рівень {html.escape(str(fm.get("level")))}</h3><ol>')
    n+=1
    room=fm.get('room') or ''
    o.write(f'<li><span class="n">{n}</span><span class="rm">{html.escape(room)}</span>'
            f'<span class="tt">{html.escape(fm.get("title",""))}</span></li>')
o.write('</ol></section>')

# items
n=0
for iid, fm, body in items:
    n+=1
    loc=f'Крило {fm.get("wing")}, рівень {fm.get("level")}'
    if fm.get('room'): loc+=f', зала {fm["room"]}'
    o.write('<section class="item">')
    o.write(f'<div class="kicker">{n} / {len(items)} · {html.escape(loc)}</div>')
    o.write(f'<h2>{html.escape(fm.get("title",""))}</h2>')
    artist=fm.get('artist','')
    if artist in (None,'null',''): artist='Автор невідомий'
    o.write(f'<div class="byline">{html.escape(artist)} · {html.escape(fm.get("date",""))}</div>')

    rows=[]
    def add(k,v):
        if v and v not in ('null','None'): rows.append((k,v))
    add('Оригінальна назва', fm.get('title_fr'))
    add('Назва англійською', fm.get('title_en'))
    add('Роки життя', fm.get('artist_dates'))
    add('Техніка', fm.get('medium'))
    add('Розміри', fm.get('dimensions'))
    add('Інвентарний номер', fm.get('inventory'))
    add('Відділ', fm.get('department'))
    add('Галерея', fm.get('gallery'))
    add('Тип', TYPE.get(fm.get('category'), fm.get('category')))
    add('Скільки часу', fm.get('time_needed'))
    add('Людно', CROWD.get(fm.get('crowd'), fm.get('crowd')))
    o.write('<table class="meta">')
    for k,v in rows:
        o.write(f'<tr><td class="k">{html.escape(k)}</td><td>{html.escape(str(v))}</td></tr>')
    o.write('</table>')

    if iid in imgs:
        o.write(f'<figure><img src="{imgs[iid]}" alt="">'
                f'<figcaption>{html.escape(fm.get("title",""))}. '
                f'Джерело: Вікісховище, ліцензія {html.escape(fm.get("image_license","?"))}.</figcaption></figure>')

    o.write(md(body))
    o.write('</section>')

# credits
o.write('<section class="credits"><h2>Зображення та ліцензії</h2>')
o.write('<p>Усі зображення взято з Вікісховища. Нижче для кожного експоната подано ліцензію і '
        'сторінку опису файлу, де вказано автора. Для всього, що не є суспільним надбанням, '
        'поширення вимагає зазначення авторства.</p>')
o.write('<table class="cr"><tr><th>Експонат</th><th>Ліцензія</th><th>Сторінка файлу</th></tr>')
for iid, fm, body in items:
    o.write(f'<tr><td>{html.escape(fm.get("title",""))}</td>'
            f'<td>{html.escape(fm.get("image_license","?"))}</td>'
            f'<td>{html.escape(fm.get("image_source",""))}</td></tr>')
o.write('</table></section>')

o.write('</body></html>')
htmlpath = os.path.join(CACHE, 'guide.html')
open(htmlpath, 'w', encoding='utf-8').write(o.getvalue())
print('html: %d KB, %d items, %d images' % (len(o.getvalue()) // 1024, len(items), len(imgs)))

pdf = os.path.join(ROOT, 'Louvre-Guide-UK.pdf')
chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
subprocess.run([chrome, '--headless=new', '--disable-gpu', '--no-sandbox',
                '--no-pdf-header-footer', '--virtual-time-budget=60000',
                '--run-all-compositor-stages-before-draw',
                '--print-to-pdf=' + pdf, 'file://' + htmlpath],
               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print('wrote', pdf, '%.1f MB' % (os.path.getsize(pdf) / 1e6))

import re, os

os.chdir(os.path.dirname(__file__))
css = open('src/style.tpl.css').read()
DARK = "--t-bg:#0f0f14;--t-bgCard:#1a1a22;--t-bgHover:#22222c;--t-bgElevated:#252532;--t-bgInput:#1e1e28;--t-border:#2a2a38;--t-borderLight:#3a3a4a;--t-text:#f0f0f5;--t-textSecondary:#a0a0b8;--t-textMuted:#6b6b82;--t-primary:#e63946;--t-primaryHover:#c12a37;--t-primaryFg:#fff;--t-accent:#ff6b35;--t-success:#2ecc71;--t-danger:#e74c3c;--t-warning:#f39c12;--t-info:#3498db;--t-gold:#f1c40f;--t-surface:#13131a;--t-sidebar:linear-gradient(180deg,#12121a 0%,#0a0a10 100%);--t-sbText:#f0f0f5;--t-sbMuted:#8a8aa3;--t-shadow:0 4px 24px #0000004d;--t-shadowLg:0 12px 40px #00000073;--t-overlay:#000000a6;"
LIGHT = "--t-bg:#f3f4f8;--t-bgCard:#ffffff;--t-bgHover:#eef0f6;--t-bgElevated:#ffffff;--t-bgInput:#f1f3f8;--t-border:#e3e6ee;--t-borderLight:#d0d5e2;--t-text:#1b1c26;--t-textSecondary:#565a70;--t-textMuted:#8a8ea4;--t-primary:#e63946;--t-primaryHover:#c12a37;--t-primaryFg:#fff;--t-accent:#ff6b35;--t-success:#16a34a;--t-danger:#dc2626;--t-warning:#d97706;--t-info:#2563eb;--t-gold:#ca8a04;--t-surface:#ffffff;--t-sidebar:linear-gradient(180deg,#ffffff 0%,#f0f2f8 100%);--t-sbText:#1b1c26;--t-sbMuted:#7a7e94;--t-shadow:0 4px 20px #1b1c2614;--t-shadowLg:0 12px 40px #1b1c2626;--t-overlay:#1b1c2680;"
WARM = "--t-bg:#f6efe5;--t-bgCard:#fffaf2;--t-bgHover:#f1e5d5;--t-bgElevated:#fffdf9;--t-bgInput:#f3e8d9;--t-border:#e6d7c2;--t-borderLight:#d6c3a8;--t-text:#3a2a1e;--t-textSecondary:#725c48;--t-textMuted:#a08a74;--t-primary:#d6402f;--t-primaryHover:#b93223;--t-primaryFg:#fff;--t-accent:#e08a2b;--t-success:#2f8f4e;--t-danger:#c0392b;--t-warning:#c77d0a;--t-info:#2f6f9f;--t-gold:#b8860b;--t-surface:#fffaf2;--t-sidebar:linear-gradient(180deg,#3b2a1e 0%,#2a1c12 100%);--t-sbText:#f7ecdd;--t-sbMuted:#c2a88c;--t-shadow:0 4px 20px #3a2a1e1f;--t-shadowLg:0 12px 40px #3a2a1e33;--t-overlay:#2a1c1299;"
css = css.replace('/*DARK*/', DARK).replace('/*LIGHT*/', LIGHT).replace('/*WARM*/', WARM)

htmcore = open('src/htm.core.js').read()
js = '\n'.join(open('src/' + f).read() for f in ['logic.js', 'ui1.js', 'ui2.js', 'ui3.js'])

page = '''<!doctype html>
<html lang="en" data-skin="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Mister Hogs · SmartPOS v2</title>
<style>
%s
</style>
</head>
<body>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>
%s
</script>
<script>
if(!window.React||!window.ReactDOM||!window.htm){document.getElementById('root').innerHTML='<p style="padding:24px;font-family:sans-serif">This page needs to load React once from the internet the first time (it is then cached by your browser). Connect briefly and reload.</p>';throw new Error('libs missing');}
</script>
<script>
%s
</script>
</body>
</html>
''' % (css, htmcore, js)

os.makedirs('public', exist_ok=True)
open('public/index.html', 'w').write(page)
print(len(page), 'bytes written to public/index.html')

"""Build the static Python catalogue from its JSON manifest and source files."""

from html import escape
from pathlib import Path
from urllib.parse import quote
import json
import re
import tokenize


ROOT = Path(__file__).resolve().parents[1] / 'dist' / 'codes' / 'python'
SOURCES = ROOT / 'sources'


def source_path(name):
    path = (SOURCES / name).resolve()
    if not path.is_relative_to(SOURCES.resolve()):
        raise ValueError(f'Chemin hors de sources/: {name}')
    return path


def slug(value):
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', value):
        raise ValueError(f'Identifiant invalide: {value}')
    return value


def layout(title, prefix, back, back_label, body, *, reader=False):
    assets = prefix + '../../'
    scripts = f'\n  <script defer src="{prefix}runner.js"></script>' if reader else ''
    page_class = 'portal python-reader' if reader else 'portal'
    return f'''<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#9f825a">
  <title>{escape(title)} · Cépagrave</title>
  <link rel="icon" type="image/jpeg" href="{assets}assets/avatar-cpasgrave.jpg">
  <link rel="stylesheet" href="{assets}style.css?v=sections">
  <link rel="stylesheet" href="{prefix}catalogue.css">{scripts}
</head>
<body>
  <main class="{page_class}">
    <header class="identity">
      <a class="identity-home" href="{back}" aria-label="{escape(back_label)}">
        <img class="avatar" src="{assets}assets/avatar-cpasgrave.jpg" alt="" width="460" height="460">
      </a>
      <h1>{escape(title)}</h1>
    </header>
{body}
  </main>
</body>
</html>
'''


def write_page(path, *args, **kwargs):
    path.parent.mkdir(parents=True, exist_ok=True)
    html = layout(*args, **kwargs)
    if not path.exists() or path.read_bytes() != html.encode('utf-8'):
        path.write_text(html, encoding='utf-8', newline='\n')


def runner_options(entry, source):
    options = {key: entry[key] for key in ('packages', 'urls') if key in entry}
    options['filename'] = Path(entry['file']).name
    if 'files' in entry:
        options['files'] = [
            {'name': asset['name'], 'text': source_path(asset['file']).read_text(encoding='utf-8')}
            if 'file' in asset else asset
            for asset in entry['files']
        ]
    adapted = source
    for before, after in entry.get('replacements', []):
        if before not in adapted:
            raise ValueError(f'Adaptation périmée: {entry["file"]}')
        adapted = adapted.replace(before, after, 1)
    if 'example' in entry:
        adapted += '\n\n' + entry['example'] + '\n'
    compile(adapted, entry['file'], 'exec')
    if adapted != source:
        options['code'] = adapted
    # Keep literal HTML closing tags inside the JSON from ending the element.
    return json.dumps(options, ensure_ascii=False).replace('<', '\\u003c')


def render_entry(category, entry):
    entry_id = slug(entry['id'])
    source_file = entry['file']
    with tokenize.open(source_path(source_file)) as file:
        source = file.read()
    source_link = f'      <a href="../sources/{quote(source_file)}" download>Télécharger le .py</a>'
    if 'github' in entry:
        source_link += f'\n      <a href="{escape(entry["github"])}">Source sur GitHub</a>'
    stdin = ''
    if 'input' in entry:
        stdin = f'''      <label for="python-input">Entrées du programme <span>(une valeur par ligne)</span></label>
      <textarea id="python-input" rows="{min(5, max(2, len(entry['input'].splitlines())))}" spellcheck="false">{escape(entry['input'])}</textarea>
'''
    note = f'    <p class="python-note">{escape(entry["note"])}</p>\n' if 'note' in entry else ''
    body = f'''
    <div class="python-links">
      <a href="index.html">{escape(category['title'])}</a>
{source_link}
    </div>
    <h2>Code Python</h2>
    <pre class="python-source" tabindex="0" aria-label="Code Python"><code id="python-source">{escape(source)}</code></pre>
{note}    <form class="python-console" id="python-console">
{stdin}      <div class="python-controls">
        <button class="project project--small" id="python-run" type="submit" disabled>Exécuter</button>
        <button class="python-stop" id="python-stop" type="button" disabled>Arrêter</button>
        <span id="python-status" role="status"></span>
      </div>
      <h2 id="python-output-label">Sortie</h2>
      <pre id="python-output" class="python-output" tabindex="0" aria-labelledby="python-output-label"></pre>
    </form>
    <noscript><p>Active JavaScript pour exécuter le code.</p></noscript>
    <script type="application/json" id="python-options">{runner_options(entry, source)}</script>'''
    write_page(ROOT / category['id'] / f'{entry_id}.html', entry['title'], '../',
               'index.html', f'Retour à {category["title"]}', body, reader=True)


def render_category(category):
    category_id = slug(category['id'])
    entries = category['entries']
    if len({entry['id'] for entry in entries}) != len(entries):
        raise ValueError(f'Identifiants en double dans {category_id}')
    links = '\n'.join(
        f'      <li><a class="project project--small" href="{slug(entry["id"])}.html">{escape(entry["title"])}</a></li>'
        for entry in entries
    )
    body = f'''
    <ul class="python-list" aria-label="Scripts Python">
{links}
    </ul>'''
    write_page(ROOT / category_id / 'index.html', category['title'], '../',
               '../index.html', 'Retour à Python', body)
    for entry in entries:
        render_entry(category, entry)


def main():
    categories = json.loads((ROOT / 'catalogue.json').read_text(encoding='utf-8'))['categories']
    if len({category['id'] for category in categories}) != len(categories):
        raise ValueError('Identifiants de catégories en double')
    for category in categories:
        render_category(category)
    links = '\n'.join(
        f'      <a class="project project--small project--section" href="{category["id"]}/index.html">{escape(category["title"])}</a>'
        for category in categories
    )
    body = f'''
    <nav class="section-nav python-categories" aria-label="Catégories Python">
{links}
    </nav>'''
    write_page(ROOT / 'index.html', 'Python', '', '../index.html', 'Retour à Codes', body)
    print(f'{sum(len(category["entries"]) for category in categories)} scripts dans {len(categories)} catégories.')


if __name__ == '__main__':
    main()

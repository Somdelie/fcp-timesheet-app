from pathlib import Path

path = Path('lib/data.ts')
text = path.read_text(encoding='utf-8')
new_text = text.replace('claimDay: 0', 'claimDay: "COC"')
if text == new_text:
    print('No replacements made')
else:
    path.write_text(new_text, encoding='utf-8')
    print('Replaced claimDay: 0 occurrences')

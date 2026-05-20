import json, re

with open('plascon-full-seed.json', 'r', encoding='utf8') as f:
    data = json.load(f)

seen = {}
bad_sizes = []
missing_name = []
for idx, item in enumerate(data):
    name = item.get('name', '')
    brand = item.get('brand', '')
    if not name.strip():
        missing_name.append(idx)
    key = (brand.strip().upper(), name.strip().upper())
    seen[key] = seen.get(key, 0) + 1
    for v in item.get('variants', []):
        size = v.get('size')
        if not size or not str(size).strip():
            bad_sizes.append((idx, name, v))
        else:
            if not re.match(r'^\s*[0-9]+(?:\.[0-9]+)?\s*[A-Za-z]+\s*$', str(size).strip()):
                bad_sizes.append((idx, name, v))

print('entries:', len(data))
print('duplicates:', [(k, v) for k, v in seen.items() if v > 1])
print('missing names:', missing_name)
print('bad sizes count:', len(bad_sizes))
for x in bad_sizes[:20]:
    print(x)

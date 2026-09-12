from pathlib import Path

path = Path('app/styles/stats.css')
text = path.read_text()
text = text.replace(
'''.stats-sort a {
  min-width: 96px;
''',
'''.stats-sort a,
.stats-sort button {
  min-width: 96px;
'''
)
text = text.replace(
'''  flex: 0 0 auto;
  border-radius: 8px;
''',
'''  flex: 0 0 auto;
  border: 0;
  border-radius: 8px;
  background: transparent;
''',
1
)
text = text.replace(
'''  font-weight: 800;
  padding: 9px 12px;
''',
'''  font-weight: 800;
  padding: 9px 12px;
  cursor: pointer;
''',
1
)
text = text.replace(
'''.stats-sort a.is-active {
''',
'''.stats-sort a.is-active,
.stats-sort button.is-active {
'''
)
path.write_text(text)

from pathlib import Path

path = Path('app/styles/stats.css')
text = path.read_text()
text = text.replace('.stats-sort a {', '.stats-sort a,\n.stats-sort button {')
text = text.replace('  flex: 0 0 auto;\n  border-radius: 8px;\n  color: var(--muted);', '  flex: 0 0 auto;\n  border: 0;\n  border-radius: 8px;\n  background: transparent;\n  color: var(--muted);', 1)
text = text.replace('  font-weight: 800;\n  padding: 9px 12px;\n  scroll-snap-align: start;', '  font-weight: 800;\n  padding: 9px 12px;\n  cursor: pointer;\n  scroll-snap-align: start;', 1)
text = text.replace('.stats-sort a.is-active {', '.stats-sort a.is-active,\n.stats-sort button.is-active {')
path.write_text(text)

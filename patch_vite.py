import re

f = 'node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js'
with open(f, 'r') as fh:
    c = fh.read()

# Wrap exec("net use"... in try/catch to survive sandboxed environments
old = 'exec("net use"'
new = 'try { exec("net use"'
c = c.replace(old, new)

with open(f, 'w') as fh:
    fh.write(c)

print('patched')


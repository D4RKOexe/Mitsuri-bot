with open('/data/data/com.termux/files/home/MiBot/index.js', 'r') as f:
    content = f.read()

content = content.replace(
    '"❌ Escribe tu pregunta.
Ejemplo: .ia qué es la fotosíntesis"',
    '"❌ Escribe tu pregunta.\
Ejemplo: .ia qué es la fotosíntesis"'
)
content = content.replace(
    '"❌ Escribe tu pregunta.
Ejemplo: .gpt explícame python"',
    '"❌ Escribe tu pregunta.\
Ejemplo: .gpt explícame python"'
)

with open('/data/data/com.termux/files/home/MiBot/index.js', 'w') as f:
    f.write(content)

print("✅ Listo")

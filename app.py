import json

# Cargar el archivo JSON original
with open('Convertir.json', 'r', encoding='utf-8') as file:
    data = json.load(file)

# Inicializar las estructuras para proveedores y laboratorios
proveedores = {}
laboratorios = {}

# Asignar relaciones
for entry in data:
    proveedor = entry['Proveedor']
    laboratorio = entry['Laboratorio']
    
    # Agregar laboratorios al proveedor
    if proveedor not in proveedores:
        proveedores[proveedor] = {
            'nombre': proveedor,
            'laboratorios': []
        }
    proveedores[proveedor]['laboratorios'].append(laboratorio)

    # Agregar proveedores al laboratorio
    if laboratorio not in laboratorios:
        laboratorios[laboratorio] = {
            'nombre': laboratorio,
            'proveedores': []
        }
    laboratorios[laboratorio]['proveedores'].append(proveedor)

# Convertir los diccionarios a listas
proveedores_list = list(proveedores.values())
laboratorios_list = list(laboratorios.values())

# Estructura final
estructura_final = {
    'proveedores': proveedores_list,
    'laboratorios': laboratorios_list
}

# Guardar el nuevo archivo JSON en el formato requerido
with open('proveedores_formateados.json', 'w', encoding='utf-8') as file:
    json.dump(estructura_final, file, ensure_ascii=False, indent=4)

print("El archivo JSON ha sido formateado correctamente.")

import csv, sys, json

output = []

with open(sys.argv[1], 'rb') as f:
    reader = csv.reader(f, delimiter=';')
    for row in reader:
        image = {'name': row[0], 'coords': []}
        points = [float(p) for p in row[1:] if p not in ['true', 'false', 'null', None]]
        i = 0
        while i < len(points):
            #print points[i]
            #coord = [float(points[i]), float(points[i+1])]
            #image['coords'].append(coord)
            image['coords'].append(points[i:i+2])
            i += 2
        output.append(image)

print json.dumps(output)

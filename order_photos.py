#import json

#json_data = open('javascript/images.json').readlines()
#data = json.loads(json_data)
#json_data.close()

#for image in data:
    #print image['tags']


import json
import random
from fractions import Fraction
from pprint import pprint
from itertools import groupby

with open('images3.json') as data_file:
    data = json.load(data_file)

tags = {}

serious = []
funny = []

names = []

for image in data:
    if image['name'] in names:
        print image['name']
    else:
        names.append(image['name'])

    for tag in image['tags']:
        if tag in tags:
            tags[tag] += 1
        else:
            tags[tag] = 1


serious = [i for i in data if 'serious' in i['tags']]
funny = [i for i in data if 'funny' in i['tags']]
far = [i for i in data if 'far' in i['tags']]
close = [i for i in data if 'close' in i['tags']]

famous = [i for i in data if 'famous' in i['tags']]
not_famous = [i for i in data if 'famous' not in i['tags']]


a = serious
b = funny

random.shuffle(a)
random.shuffle(b)

len_ab = len(a) + len(b)
groups = groupby(((a[len(a)*i//len_ab], b[len(b)*i//len_ab]) for i in range(len_ab)), key=lambda x:x[0])
output = [j[i] for k,g in groups for i,j in enumerate(g)]

print 'var images = ['
for item in output:
    print '{'
    print '  "name": ' + json.dumps(item['name']) + ','
    print '  "tags": ' + json.dumps(item['tags']) + ','
    if 'bw' in item.keys():
        print '  "bw": ' + json.dumps(item['bw']) + ','
    print '  "coords": ' + json.dumps(item['coords'])
    print '},'

print '];'

def get_pins(observed):
    adj = {
    '1':'24',
    '2':'135',
    '3':'26',
    '4':'157',
    '5':'2468',
    '6':'359',
    '7':'48',
    '8':'5790',
    '9':'68',
    '0':'8',
    }
    possible = ['']
    for i in range(len(observed)):
        oi = observed[i]
        for j in range(len(possible)):
            possible += [possible[j]+a for a in adj[oi]]
            possible[j] += oi
    return possible
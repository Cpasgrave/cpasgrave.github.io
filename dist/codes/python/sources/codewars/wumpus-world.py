from functools import cache

@cache
def possca(n_pits):

    # producing all the possible caves with n_pits pits and 1 wumpus:
    # '+' is for reachable room
    possible_caves = ["+"+"_"*15]
    for p in range(n_pits): # placing the pits
        new_caves = []
        for poss_cave in possible_caves:
            ct = p
            for i in range(1,16):
                if poss_cave[i]=='P': ct -= 1
                if poss_cave[i]=='_' and ct==0:
                    new_caves  += [''.join([c if j!=i else 'P' for j,c in enumerate(poss_cave)])]
        possible_caves = new_caves
    new_caves = []
    for poss_cave in possible_caves: # placing the wumpus
        for i in range(1,16):
            if poss_cave[i] == '_':
                new_caves += [''.join([c if j!=i else 'W' for j,c in enumerate(poss_cave)])]
    return new_caves


def wumpus_world(cave):

    if cave[0][1] in 'PW' or cave[1][0] in 'PW': return False

    rg16 = range(16)
    n_pits = sum([c.count('P')for c in cave])
    cave = [c for row in cave for c in row]
    cave[0] = '+'
    neighbors = {n:{m if cond else None for (m,cond) in [(n-1,n%4),(n+1,(n+1)%4),(n-4,n>3),(n+4,n<12)]}-{None} for n in rg16}
    smells = {room:{cave[n] for n in neighbors[room] if cave[n] in 'WP'} for room in rg16}
    w_dead = 0

    # creating all the possible caves with n_pits P, 1 G and 1 W, in a 4x4 grid, with (0,0) free.
    possible_caves = possca(n_pits)

    # Entering the cave with a wide open nose
    while True:

        a = len(possible_caves)
        b = cave.count('+')

        for room in rg16:
            if cave[room]=='+':
                neighrooms = neighbors[room]
                smell = smells[room]
                if smell=={'P'}:
                    possible_caves = [p_c for p_c in possible_caves if any(p_c[n]=='P' for n in neighrooms)]
                    possible_caves = [p_c for p_c in possible_caves if all(p_c[n]!='W' for n in neighrooms)]
                elif smell=={'W'}:
                    possible_caves = [p_c for p_c in possible_caves if any(p_c[n]=='W' for n in neighrooms)]
                    possible_caves = [p_c for p_c in possible_caves if all(p_c[n]!='P' for n in neighrooms)]
                elif smell=={'P','W'}:
                    possible_caves = [p_c for p_c in possible_caves if any(p_c[n]=='P' for n in neighrooms) and any(p_c[n]=='W' for n in neighrooms)]
                else: # smell==set():
                    # no smell in this rooom
                    for neighbor in neighrooms:
                        if cave[neighbor] == '_':
                            cave[neighbor] = '+'
                            possible_caves = [p_c for p_c in possible_caves if p_c[neighbor]=='_']
                        elif cave[neighbor] == 'G': return True

        possibly_pits = set()
        w_poss_loc = set()
        for p_c in possible_caves:
            for i in rg16:
                if p_c[i]=='P': possibly_pits |= {i}
                elif p_c[i]=='W': w_poss_loc |= {i}
        for room in rg16:
            if cave[room]=='+' and smells[room]=={'P'}:
                for n in neighbors[room]:
                    if n not in possibly_pits:
                        if cave[n]=='G': return True
                        else: cave[n] = '+'
        if not w_dead:
            w_poss_loc = set(i for poss_cave in possible_caves for i in rg16 if poss_cave[i]=='W')
            if len(w_poss_loc)==1:
                # kill the Wumpus
                w = w_poss_loc.pop()
                for neighbor in neighbors[w]: smells[neighbor] -= {'W'}
                cave[w] = '+' if any(cave[n]=='+' for n in neighbors[w]) else '_'
                possible_caves = list({p_c.replace('W','_') for p_c in possible_caves})
                w_dead = 1

        if len(possible_caves)==a and cave.count('+')==b:
            break # no progress => no solution

    return False 
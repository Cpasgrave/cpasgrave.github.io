def count_patterns_from(firstPoint, length):
    link = {
    "A": ["BC","F","EI","H","DG"],
    "B": ["C","F","I","EH","G","D","A"],
    "C": ["FI","H","EG","D","BA"],
    "D": ["A","B","C","EF","I","H","G"],
    "E": ["B","C","F","I","H","G","D","A"],
    "F": ["C","I","H","G","ED","A","B"],
    "G": ["DA","B","EC","F","HI"],
    "H": ["EB","C","F","I","G","D","A"],
    "I": ["FC","HG","D","EA","B"],
    }
    count = 0
    paths = [firstPoint]
    while paths:
        path = paths.pop()
        if len(path)==length:
            count += 1
            continue
        for nxt in link[path[-1]]:
            nx = nxt[0]
            if nx in path:
                if len(nxt)==2:
                    nx = nxt[1]
                    if nx in path: continue
                    else: paths.append(path+nx)
                else: continue
            else: paths.append(path+nx)
    return count
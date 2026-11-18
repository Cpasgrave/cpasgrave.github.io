def codewar_result(cw,op):
    l = len(cw)
    C,O = sorted(cw), sorted(op)
    # dic giving the set of all indices for each values of C
    Ci_per_value = {}
    Cvs = [set()for _ in range(l)] # possible victories set for each index
    Ces = [set()for _ in range(l)] # possible equalities set for each index
    # i are indices for C (sorted codewariors), j for O (sorted opponents)
    i = j = l-1
    # Analyzing data, building Cvs, Ces, Ci_per_value
    while i>-1:
        Cval,Oval = C[i],O[j]
        Ci_per_value[Cval] = Ci_per_value.get(Cval,set())|{i}
        if i<l-1 and Cval==C[i+1]:
            Cvs[i],Ces[i] = Cvs[i+1],Ces[i+1]
            i -= 1
        elif Cval==Oval:
            Ces[i] |= {j}
            if j==0: i -= 1
            else: j -= 1
        elif Cval>Oval:
            Cvs[i] = set(range(j+1))
            i -= 1
        else:
            if j==0: i -= 1
            else: j -= 1

    O_values = sorted(set(O))
    # dic giving for each value of O, the set of indices where C's value is >
    Ci_gt_Ov = {}
    # dic giving the set of all indices for each values of O
    Oj_per_value = {o:set()for o in O_values}
    for j in range(l): Oj_per_value[O[j]] |= {j}
    j = 0
    for Oval in sorted(set(O)):
        while Cval<=Oval and j<l:
            j += 1
            Cval = C[j]if j<l else float('inf')
        Ci_gt_Ov[Oval] = {*range(j,l)}

    # pairing victories and equalities 
    # with the highest possible indices
    # priority to victories
    C_vic,O_def,C_eq,O_eq = set(),set(),set(),set()
    pairs = {} # keys=Ci index of cw, values=Oj index of op
    score = 0
    for i in range(l-1,-1,-1):
        vics = Cvs[i]-O_def-O_eq
        if vics:
            j = max(vics)
            score += 2
            C_vic |= {i}
            O_def |= {j}
            pairs[i] = j
        else:
            e = Ces[i]-O_def-O_eq
            if e:
                j = max(e)
                score += 1
                C_eq |= {i}
                O_eq |= {j}
    if score>l: return 'Victory'
    # Trying to modify some winning pairs by choosing
    # lower looser Oj and lower winner Ci when possible 
    # and, doing so, allow extra equalities if there are.
    C_may_eq = {i for i in range(l)if Ces[i]}
    O_may_eq = set.union(*Ces)

    candidates = sorted(C_vic)
    for ci in candidates:
        cv = C[ci]
        # try to lower the looser Oj
        oj = pairs[ci]
        left_oj = min({*range(oj)}-O_def-O_eq,default=oj)
        left_ov = O[left_oj]
        if left_oj!=oj:
            # updating O_def
            O_def = (O_def|{left_oj})-{oj}
            # check for new equality
            ov = O[oj]
            if oj in O_may_eq:
                eq = min(Ci_per_value[ov]&(C_may_eq-C_vic-C_eq),default=None)
                if eq!=None:
                    C_eq |= {eq}
                    O_eq |= {oj}
                    score += 1
        # try to lower the wining Ci
        left_ci = min(Ci_gt_Ov[left_ov]-C_vic-C_eq,default=ci)
        left_cv = C[left_ci]
        if left_ci!=ci:
            # updating C_vic
            C_vic = (C_vic|{left_ci})-{ci}
            # check for new equality
            if ci in C_may_eq:
                eq = min(Oj_per_value[cv]&(O_may_eq-O_def-O_eq),default=None)
                if eq!=None:
                    O_eq |= {eq}
                    C_eq |= {ci}
                    score += 1
    return ('Defeat','Stalemate','Victory')[(score>=l)+(score>l)]
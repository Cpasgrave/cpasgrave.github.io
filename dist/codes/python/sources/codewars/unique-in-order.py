def unique_in_order(it):
    l = list(it[0:1])
    for i in range(1, len(it)):
        if it[i] != it[i - 1]:
            l.append(it[i])
    return l
def total_inc_dec(x):
    inc = [[r for r in range(x)]]
    for i in range(1,9):
        inc.append([sum(inc[i-1][:j+1])+inc[0][j] for j in range(x)])
    return sum(sum(i)*2 for i in inc[:-1])+sum(inc[-1])+9*x+1
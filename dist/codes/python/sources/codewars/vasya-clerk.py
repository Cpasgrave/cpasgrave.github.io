def tickets(people):
    change = {25: 0, 50: 0}
    for i in people:
        if i == 25:
            change[25] += 1
        if i == 50:
            change[25] -= 1
            change[50] += 1
        if i == 100:
            if change[50] > 0:
                change[50] -= 1
                change[25] -= 1
            else:
                change[25] -= 3
        if change[25] < 0 or change[50] < 0:
            return "NO"
    return "YES"
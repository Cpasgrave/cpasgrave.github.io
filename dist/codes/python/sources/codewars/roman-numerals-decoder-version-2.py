def solution(roman):
    d = {'M': 1000, 'D': 500, 'C': 100, 'L': 50, 'X': 10, "V":5, 'I': 1}
    a = [d[i] for i in roman]
    for i in range(len(a) - 1):
        if a[i] < a[i + 1]:
            a[i] = -a[i]
    return sum(a)
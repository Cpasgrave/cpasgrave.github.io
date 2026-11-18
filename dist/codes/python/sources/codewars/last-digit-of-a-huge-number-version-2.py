def last_digit(lst):
  res = 1
  for i in lst[::-1]:
    temp = str(res)[-2:]
    print('temp',temp)
    if temp[0] == '0': res = int(str(res)[:-1].rstrip('0')[-1:]+temp)
    else: res = int(str(res)[-2:])
    res = i**res
  return int(str(res)[-1])
    
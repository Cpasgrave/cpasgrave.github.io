def sum_of_intervals(intervals):
  res = set()
  for i in intervals:
    res.update(range(*i))
  return len(res)
from regex import *
def regex_tic_tac_toe_win_checker(board):
	pat = r"^.{,6}(O|X)(\1\1($|...$|.{6}$)|.\1.\1..$|..\1..\1|...\1...\1)"
	return search(pat,board)!=None

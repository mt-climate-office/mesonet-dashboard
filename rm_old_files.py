import pathlib
import time

PATH = pathlib.Path("/app/static")
def test():
    n = 0
    while True:
        pth = PATH / f"{n}.txt"
        pth.touch()
        time.sleep(60)

if __name__ == "__main__": 
    test()
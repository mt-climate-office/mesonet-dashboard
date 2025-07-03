import datetime as dt
from typing import Literal
import polars as pl

def create_plot(df: pl.DataFrame, variables: list[str], color=str, type=Literal["line", "bar"]):
    ...
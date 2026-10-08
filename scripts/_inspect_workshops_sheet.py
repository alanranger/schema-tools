import pandas as pd
p = r"G:\Dropbox\alan ranger photography\Website Code\alan-shared-resources\bookings\Booking Sheet 2024 - Alan Ranger Photography.xlsm"
df = pd.read_excel(p, sheet_name="Workshops", header=None, nrows=20)
print(df.iloc[:, :10].to_string())

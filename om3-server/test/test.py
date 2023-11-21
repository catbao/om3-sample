import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# 读取CSV文件
file_path = './om3-server/test/a4.csv'  # 替换成你的CSV文件路径
data = pd.read_csv(file_path)

# 查看数据的前几行
print(data.head())

# plt.xlabel('X轴标签')
# plt.ylabel('Y轴标签')
# plt.title('折线图')
# plt.legend()  # 显示图例

plt.figure(figsize=(600/100, 400/100), dpi=100)
plt.plot(data['t'], data['v'], linestyle='-', color='b', label='折线图')
plt.xticks(np.linspace(data['t'].min(), data['t'].max(), 11))  # 6个刻度
plt.yticks(np.linspace(data['v'].min(), data['v'].max(), 11))  # 6个刻度
plt.grid(True)  # 显示网格线
plt.show()

import requests
import random
import time

URL = "http://localhost:8082/postgres/line_chart/sensor_data/"

def generate_sensor_data():
    return {
        "temperature": random.uniform(20.0, 30.0),
        "humidity": random.uniform(30.0, 50.0),
        "timestamp": int(time.time())
    }

def send_data_to_server(data):
    response = requests.post(URL, json=data)
    if response.status_code == 200:
        print("Data sent successfully.")
    else:
        print(f"Failed to send data. Status code: {response.status_code}")

if __name__ == "__main__":
    while True:
        data = generate_sensor_data()
        send_data_to_server(data)
        time.sleep(5)  

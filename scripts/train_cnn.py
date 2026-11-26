"""Train and export the site's Keras CNN and test fixtures.

MNIST is licensed CC BY-SA 3.0 (Yann LeCun and Corinna Cortes).
From the repo root, rerun with `python scripts/train_cnn.py`.
"""

import base64
import json
from pathlib import Path

import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers


ROOT = Path(__file__).resolve().parents[1]
WEIGHTED_LAYERS = ("conv1", "conv2", "dense1", "dense2")


def normalize(images):
    return images[..., np.newaxis].astype(np.float32) / 255.0


def build_model():
    return keras.Sequential([
        keras.Input(shape=(28, 28, 1)),
        layers.Conv2D(8, 3, padding="valid", activation="relu", data_format="channels_last", name="conv1"),
        layers.MaxPooling2D(2, data_format="channels_last", name="pool1"),
        layers.Conv2D(16, 3, padding="valid", activation="relu", data_format="channels_last", name="conv2"),
        layers.MaxPooling2D(2, data_format="channels_last", name="pool2"),
        layers.Flatten(data_format="channels_last"),
        layers.Dense(64, activation="relu", name="dense1"),
        layers.Dense(10, activation="softmax", name="dense2"),
    ], name="mnist_cnn")


def encode_weights(values):
    return base64.b64encode(values.astype("<f4").tobytes(order="C")).decode("ascii")


def round_rows(values):
    return [[float(f"{value:.7g}") for value in row] for row in values]


def write_json(relative_path, data):
    path = ROOT / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")


def main():
    keras.utils.set_random_seed(42)
    tf.config.experimental.enable_op_determinism()
    (train_images, train_labels), (test_images, test_labels) = keras.datasets.mnist.load_data()
    model = build_model()
    augmenter = keras.Sequential([
        layers.RandomRotation(10 / 360, fill_mode="constant", data_format="channels_last"),
        layers.RandomTranslation(2 / 28, 2 / 28, fill_mode="constant", data_format="channels_last"),
        layers.RandomZoom(0.1, fill_mode="constant", data_format="channels_last"),
    ])
    trainer = keras.Sequential([keras.Input(shape=(28, 28, 1)), augmenter, model])
    trainer.compile(optimizer=keras.optimizers.Adam(learning_rate=0.002),
                    loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    rates = [0.002] * 4 + [0.001] * 2 + [0.0005] * 2
    schedule = keras.callbacks.LearningRateScheduler(lambda epoch: rates[epoch])
    trainer.fit(normalize(train_images), train_labels, epochs=len(rates), batch_size=128,
                callbacks=[schedule], verbose=2)

    model.compile(loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    _, accuracy = model.evaluate(normalize(test_images), test_labels, batch_size=128, verbose=0)
    print(f"MNIST test accuracy: {accuracy:.2%}")

    weights = {}
    for name in WEIGHTED_LAYERS:
        kernel, bias = model.get_layer(name).get_weights()
        weights[name] = {"shape": list(kernel.shape), "w": encode_weights(kernel), "b": encode_weights(bias)}
    write_json("public/models/mnist-cnn.json", {
        "format": "mlv-cnn-1", "test_accuracy": float(f"{accuracy:.7g}"), "layers": weights,
    })

    indices = np.arange(6)
    samples = normalize(test_images[indices])
    feature_maps = model.get_layer("conv1")(samples).numpy()
    write_json("src/deep/fixtures/mnist-samples.json", {
        "source": "MNIST test set (CC BY-SA 3.0)",
        "indices": indices.tolist(),
        "labels": test_labels[indices].tolist(),
        "images": test_images[indices].reshape(len(indices), -1).tolist(),
        "probs": round_rows(model.predict(samples, verbose=0)),
        "conv1_mean": round_rows(feature_maps.mean(axis=(1, 2))),
    })


if __name__ == "__main__":
    main()

"""Deployment identity of the approved, immutable classification artifact."""
MODEL_ID = "convnextv2_tiny.fcmae_ft_in1k"
MODEL_NAME = "ConvNeXtV2-Tiny"
MODEL_SHA256 = "f5327345f0c3bd0bd4df7315e72b49e406185979cad1b89803c6ffe85545aa24"
EXPERIMENT_HASH = "94eb2b7098910e"
CLASS_SLUGS = ["black_gill", "black_spot", "healthy", "white_spot"]
VIETNAMESE_LABELS = dict(zip(CLASS_SLUGS, ["Bệnh đen mang", "Bệnh đốm đen", "Tôm khỏe mạnh", "Bệnh đốm trắng"]))

import os
from PIL import Image
import pillow_avif

# Usa automaticamente la cartella dove si trova questo script
CARTELLA = os.path.dirname(os.path.abspath(__file__))

# Qualità AVIF
QUALITA = 70

for nome_file in os.listdir(CARTELLA):

    if not nome_file.lower().endswith((".jpg", ".jpeg")):
        continue

    percorso_jpg = os.path.join(CARTELLA, nome_file)

    nome_senza_estensione = os.path.splitext(nome_file)[0]
    percorso_avif = os.path.join(
        CARTELLA,
        nome_senza_estensione + ".avif"
    )

    try:
        with Image.open(percorso_jpg) as img:

            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGB")

            img.save(
                percorso_avif,
                "AVIF",
                quality=QUALITA
            )

        dimensione_jpg = os.path.getsize(percorso_jpg)
        dimensione_avif = os.path.getsize(percorso_avif)

        riduzione = (1 - dimensione_avif / dimensione_jpg) * 100

        print(
            f"{nome_file} -> "
            f"{nome_senza_estensione}.avif | "
            f"-{riduzione:.1f}%"
        )

    except Exception as e:
        print(f"ERRORE con {nome_file}: {e}")

print("\nConversione completata.")
input("Premi INVIO per chiudere...")
from pathlib import Path
p = Path(r"C:\Users\USER\TriNetra\frontend\src\types\api.ts")
lines = p.read_text(encoding="utf-8").splitlines()
new_lines = []
for line in lines:
    if "`n" in line:
        parts = line.split("`n")
        new_lines.append(parts[0])
        if len(parts) > 1 and "stream_url" in parts[1] and "BackendUrbanEvent" not in "".join(new_lines[-15:]):
            new_lines.append(parts[1].strip())
    else:
        new_lines.append(line)

p.write_text("\n".join(new_lines), encoding="utf-8")
print("api.ts lines processed successfully")

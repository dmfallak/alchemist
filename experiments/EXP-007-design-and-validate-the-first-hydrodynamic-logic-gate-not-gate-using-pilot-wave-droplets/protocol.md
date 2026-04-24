---
id: EXP-007
title: Design and validate the first Hydrodynamic Logic Gate (NOT Gate) using
  pilot-wave droplets.
hypothesis: A specific fluidic geometry can use pilot-wave interference to
  reliably execute a NOT logic operation, creating a patentable 'Reduction to
  Practice' for fluidic computing.
status: active
inputs: []
observations: []
safety: []
---
# Protocol: Design and validate the first Hydrodynamic Logic Gate (NOT Gate) using pilot-wave droplets.

...

## Observations
- [from TSK-006] BOM Finalized: 2x Dayton Audio DAEX32EP-4, Raspberry Pi Global Shutter Camera + 6mm Lens, 20cSt Silicone Oil, Fosi Audio TPA3116. Total est: $250. $250 reserve.
- [from TSK-010] STL Generation Script:

def create_stl():
    width, length, height = 100, 100, 6
    wall_t = 2.4
    with open("not_gate_frame.stl", "w") as f:
        f.write("solid logic_gate\n")
        def write_facet(p1, p2, p3):
            f.write("  facet normal 0 0 0\n    outer loop\n")
            for p in [p1, p2, p3]:
                f.write(f"      vertex {p[0]} {p[1]} {p[2]}\n")
            f.write("    endloop\n  endfacet\n")
        def write_box(x, y, w, l, h):
            pts = [(x, y, 0), (x+w, y, 0), (x+w, y+l, 0), (x, y+l, 0), (x, y, h), (x+w, y, h), (x+w, y+l, h), (x, y+l, h)]
            faces = [(4,5,6), (4,6,7), (0,1,2), (0,2,3), (0,1,5), (0,5,4), (1,2,6), (1,6,5), (2,3,7), (2,7,6), (3,0,4), (3,4,7)]
            for face in faces: write_facet(pts[face[0]], pts[face[1]], pts[face[2]])
        write_box(0, 0, 100, 2.4, 6) # Bottom
        write_box(0, 97.6, 100, 2.4, 6) # Top
        write_box(0, 0, 2.4, 100, 6) # Left
        write_box(97.6, 0, 2.4, 100, 6) # Right
        write_box(45, 0, 2.4, 40, 6) # Divider Low
        write_box(45, 60, 2.4, 40, 6) # Divider High
        f.write("endsolid logic_gate\n")
create_stl()
- Budget Update: $250 allocated to components (Shaker, Amp, Global Shutter Camera, Oil). $250 remaining in reserve. Printer and Pi sourced from existing inventory.
- Hypothesis: A 'walking' droplet's pilot-wave field can be geometrically constrained to create an inhibitory zone, where the presence of one droplet (Input 1) prevents a second droplet from traversing a channel (Output 0), thereby creating a physical NOT gate.
- STL Generation Script for TSK-010:

```python
def create_stl():
    # Dimensions in mm
    width, length, height = 100, 100, 6
    wall_t = 2.4  # Optimized for 0.4mm nozzle (6 perimeters)
    
    with open("not_gate_frame.stl", "w") as f:
        f.write("solid logic_gate\n")
        
        def write_facet(p1, p2, p3):
            f.write("  facet normal 0 0 0\n    outer loop\n")
            for p in [p1, p2, p3]:
                f.write(f"      vertex {p[0]} {p[1]} {p[2]}\n")
            f.write("    endloop\n  endfacet\n")

        def write_box(x, y, w, l, h):
            pts = [
                (x, y, 0), (x+w, y, 0), (x+w, y+l, 0), (x, y+l, 0),
                (x, y, h), (x+w, y, h), (x+w, y+l, h), (x, y+l, h)
            ]
            faces = [
                (4,5,6), (4,6,7), (0,1,2), (0,2,3), # Top/Bottom
                (0,1,5), (0,5,4), (1,2,6), (1,6,5), # Sides
                (2,3,7), (2,7,6), (3,0,4), (3,4,7)
            ]
            for face in faces:
                write_facet(pts[face[0]], pts[face[1]], pts[face[2]])

        # Outer Walls
        write_box(0, 0, 100, 2.4, 6) # Bottom wall
        write_box(0, 97.6, 100, 2.4, 6) # Top wall
        write_box(0, 0, 2.4, 100, 6) # Left wall
        write_box(97.6, 0, 2.4, 100, 6) # Right wall
        
        # Center Divider
        write_box(45, 0, 2.4, 40, 6) 
        write_box(45, 60, 2.4, 40, 6) 

        f.write("endsolid logic_gate\n")
create_stl()
```
- Project budget update: $250 remaining in reserve. Sourced Pi 3B and FDM printer locally. Assembly method confirmed: 3D printed frame on glass base.
- [from TSK-007] STL generator code provided for Hybrid Glass Frame (NOT Gate v1.0). Geometry optimized for FDM printing.
- [from TSK-007] NOT Gate V1.0 Geometry finalized: 100x100mm footprint, 15mm Input Trap, 8mm Signal Channel, 2mm Coupling Window. Generating STL generation script.
- User confirmed Raspberry Pi 3B (Headless/SSH) and Hybrid Glass approach for the NOT gate. Designing frame for FDM printing with silicone sealant interface.
- Hardware constraint updated: Using FDM (filament) printer. To ensure floor smoothness for Faraday waves, we will move to a 'Hybrid Basin' design: 3D-printed walls over a glass or mirror floor.

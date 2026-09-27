from pathlib import Path

# 1. Update useBuses.ts
p_buses = Path(r"C:\Users\USER\TriNetra\frontend\src\hooks\useBuses.ts")
content = p_buses.read_text(encoding="utf-8")
old_buses_catch = """    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || "Failed to load buses from backend.";
      setError(msg);
      setBackendOnline(false);
      // Fallback to mock data on backend failure
      const filtered = statusFilter
        ? MOCK_BUSES.filter((b) => b.status === statusFilter)
        : MOCK_BUSES;
      setBuses(filtered);
    }"""
new_buses_catch = """    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || "Failed to load buses from backend.";
      setError(msg);
      setBackendOnline(false);
    }"""
if old_buses_catch in content:
    content = content.replace(old_buses_catch, new_buses_catch, 1)
    p_buses.write_text(content, encoding="utf-8")
    print("Updated useBuses.ts")
else:
    print("useBuses.ts catch block not matched")

# 2. Update useEvents.ts
p_events = Path(r"C:\Users\USER\TriNetra\frontend\src\hooks\useEvents.ts")
content = p_events.read_text(encoding="utf-8")
old_events_catch = """    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || "Failed to load events from backend.";
      setError(msg);
      setBackendOnline(false);

      // Fallback to mock
      setEvents(MOCK_EVENTS);
      setTotal(MOCK_EVENTS.length);
    }"""
new_events_catch = """    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || "Failed to load events from backend.";
      setError(msg);
      setBackendOnline(false);
    }"""
if old_events_catch in content:
    content = content.replace(old_events_catch, new_events_catch, 1)
    p_events.write_text(content, encoding="utf-8")
    print("Updated useEvents.ts")
else:
    print("useEvents.ts catch block not matched")

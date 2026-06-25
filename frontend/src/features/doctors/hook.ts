// TỰ VIẾT
import { useEffect, useState } from "react";
import { getDoctors, Doctor } from "@/lib/services/doctorService";

export function useDoctors() {
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        getDoctors()
            .then(setDoctors)
            .finally(() => setLoading(false));
    }, []);

    return { doctors, loading };
}

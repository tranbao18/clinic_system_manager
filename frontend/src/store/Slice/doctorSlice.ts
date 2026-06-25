// TỰ VIẾT
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getDoctors, getDoctorById, Doctor } from "@/lib/services/doctorService";

export const fetchDoctors = createAsyncThunk("doctors/fetchAll", async () => {
    return await getDoctors();
});

export const fetchDoctorById = createAsyncThunk("doctors/fetchById", async (id: string) => {
    return await getDoctorById(id);
});

interface DoctorState {
    list: Doctor[];
    currentDoctor: Doctor | null;
    loading: boolean;
}

const doctorSlice = createSlice({
    name: "doctors",
    initialState: { list: [], currentDoctor: null, loading: false } as DoctorState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchDoctorById.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchDoctorById.fulfilled, (state, action) => {
                state.currentDoctor = action.payload;
                state.loading = false;
            })
            .addCase(fetchDoctorById.rejected, (state) => {
                state.currentDoctor = null;
                state.loading = false;
            });
    }

});

export default doctorSlice.reducer;

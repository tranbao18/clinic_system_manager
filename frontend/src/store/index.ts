// TỰ VIẾT
import { configureStore } from "@reduxjs/toolkit";
import doctorReducer from "./Slice/doctorSlice";

export const store = configureStore({
    reducer: {
        doctors: doctorReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

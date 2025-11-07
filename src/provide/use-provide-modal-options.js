import { provide, reactive } from 'vue'
import { INJECTION_KEY } from '@/constants/injection-key'
import { onThrottlePause } from '@/services/http-client'


function useProvideModalOptions() {

    const DEFAULT_CONFIRM_TEXT = '确认';
    const DEFAULT_CANCEL_TEXT = '关闭';

    const loading_modal_options = reactive({
        title: '加载中',
        title_class: '',
        content: '',
        content_class: 'text-center',
        show_cancel_button: false,
        show_loading_icon: true,
        show: false,
        show_confirm_button: false,
        confirm_text: DEFAULT_CONFIRM_TEXT,
        cancel_text: DEFAULT_CANCEL_TEXT,
    })

    /**
     * 更新加载模态窗数据
     * @param {boolean} show 
     * @param {string} content 
     */
    function show_loading_modal(show, content = '') {
        if (show !== null) {
            loading_modal_options.show = show;
        }

        loading_modal_options.content = content;
    }
    onThrottlePause(({ threshold, delay, requestCount }) => {
        const seconds = Math.ceil(delay / 1000);
        const message = `请求已达 ${requestCount} 条，防控等待 ${seconds} 秒 (阈值 ${threshold})...`;
        show_loading_modal(true, message);
    });


    provide(INJECTION_KEY.LOADING_MODAL_OPTIONS, loading_modal_options)
    provide(INJECTION_KEY.SHOW_LOADING_MODAL, show_loading_modal)



    const error_modal_options = reactive({
        title: '错误',
        title_class: 'text-danger',
        content: '',
        content_class: 'text-danger',
        show_cancel_button: true,
        show_loading_icon: false,
        show: false,
        show_confirm_button: false,
        confirm_text: DEFAULT_CONFIRM_TEXT,
        cancel_text: DEFAULT_CANCEL_TEXT,
        onConfirm: null,
    })
    function reset_error_modal_actions() {
        error_modal_options.show_confirm_button = false;
        error_modal_options.confirm_text = DEFAULT_CONFIRM_TEXT;
        error_modal_options.cancel_text = DEFAULT_CANCEL_TEXT;
        error_modal_options.onConfirm = null;
    }

    /**
     * 更新错误模态窗数据
     * @param {string} content 
     * @param {boolean} show 
     */
    function show_error_modal(show, payload = '') {

        if (show !== null) {
            error_modal_options.show = show;
        }

        if (typeof payload === 'string' || payload === undefined) {
            if (typeof payload === 'string') {
                error_modal_options.content = payload;
            }
            reset_error_modal_actions();
            return;
        }

        if (typeof payload === 'object' && payload !== null) {
            if (typeof payload.content === 'string') {
                error_modal_options.content = payload.content;
            }
            error_modal_options.show_confirm_button = Boolean(payload.show_confirm_button);
            error_modal_options.confirm_text = payload.confirm_text || DEFAULT_CONFIRM_TEXT;
            error_modal_options.cancel_text = payload.cancel_text || DEFAULT_CANCEL_TEXT;
            error_modal_options.onConfirm = error_modal_options.show_confirm_button && typeof payload.onConfirm === 'function'
                ? payload.onConfirm
                : null;
            if (!error_modal_options.show_confirm_button) {
                error_modal_options.onConfirm = null;
            }
        }
    }


    provide(INJECTION_KEY.ERROR_MODAL_OPTIONS, error_modal_options)
    provide(INJECTION_KEY.SHOW_ERROR_MODAL, show_error_modal)




}

export { useProvideModalOptions }

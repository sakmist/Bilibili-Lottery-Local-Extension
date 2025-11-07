
//动态互动类型
const REACTION_TYPE = {
    FORWARD: '转发了',
    LIKE: '赞了',
}

const RELATION_TYPE = {
    NOT_FOLLOWING: 0,
    FOLLOWING: 2,
    MUTUAL_FOLLOWING: 6,
    BLOCKED: 128,
}

/**
 * 重复评论过滤选项
 */
const REPEAT_COMMENT_FILTER_OPTIONS = {
    NONE: 'none',
    ONLY_FIRST_USER_COMMENT: 'only_first_comment_of_user',
    ONLY_ORIGINAL_COMMENT: 'only_original_comment',

    /**
     * 获取过滤选项的描述
     * 
     * @param {string} option 
     * @returns {string}
     */
    get_description: function (option) {
        let result = '';
        switch (option) {
            case this.NONE:
                result = '不限制';
                break;
            case this.ONLY_FIRST_USER_COMMENT:
                result = '只保留每个用户的首条评论';
                break;
            case this.ONLY_ORIGINAL_COMMENT:
                result = '只保留相同内容的首条评论';
                break;
        }
        return result;
    }
}


export { REACTION_TYPE, RELATION_TYPE, REPEAT_COMMENT_FILTER_OPTIONS }

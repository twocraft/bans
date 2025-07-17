create table if not exists ban
(
    id             bigint auto_increment
        primary key,
    user           varchar(255) collate utf8mb4_general_ci not null,
    common_message varchar(255)                            null,
    created_at     datetime default CURRENT_TIMESTAMP      not null,
    updated_at     datetime default CURRENT_TIMESTAMP      not null,
    constraint ban_user_uindex
        unique (user)
);

create table if not exists reporter
(
    id    bigint auto_increment primary key,
    ip    varchar(64) collate ascii_bin           not null,
    `key` varchar(256) collate ascii_bin          not null,
    name  varchar(256) collate utf8mb4_general_ci not null
);

create table if not exists ban_reason
(
    ban_id      bigint                                  not null,
    reporter_id bigint                                  not null,
    reason      varchar(256) collate utf8mb4_general_ci not null,
    type        enum ('soft', 'hard') default 'soft'    not null,
    primary key (ban_id, reporter_id),
    constraint ban_reason_ban_id_fk
        foreign key (ban_id) references ban (id)
            on update cascade on delete cascade,
    constraint ban_reason_reporter_id_fk
        foreign key (reporter_id) references reporter (id)
            on update cascade on delete cascade
);